pub mod error;
pub mod constants;

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

use crate::error::ErrorCode;
use crate::constants::{
      MAX_AGE, SOL_USD_FEED_ID,SALE_AUTHORITY
};

declare_id!("AFqeVXgZX3KWf2c2eUJM2YVEKFH2nR7PCLiCSAqsSrPp");

#[program]
pub mod token_biu {
    use super::*;

    pub fn initialize_sale(
        ctx: Context<InitializeSale>,
        token_price_usd: f64,
        mint_decimals: u64,
    ) -> Result<()> {
        let (sale_authority, _bump) =
            Pubkey::find_program_address(&[SALE_AUTHORITY], ctx.program_id);
        let sale_config = &mut ctx.accounts.sale_config;
        sale_config.authority = ctx.accounts.authority.key();
        sale_config.token_price_usd = token_price_usd;
        sale_config.paused = false;
        sale_config.mint_decimals = mint_decimals;
        sale_config.sale_authority = sale_authority;
        sale_config.recipient = ctx.accounts.recipient.key();

        Ok(())
    }

    pub fn buy_tokens(ctx: Context<BuyTokens>, sol_amount: u64) -> Result<()> {
        let sale_config = &ctx.accounts.sale_config;

        require!(!sale_config.paused, ErrorCode::SalePaused);
        // Fetch SOL/USD price from Pyth
        let feed_id: [u8; 32] =
            get_feed_id_from_hex(SOL_USD_FEED_ID)?;
        let price_data = ctx.accounts.price_update.get_price_no_older_than(
            &Clock::get()?,
            MAX_AGE,
            &feed_id,
        )?;
        let sol_price_usd = (price_data.price as f64) * 10f64.powi(price_data.exponent);
        // let sol_price_usd: f64 = 190.0;

        // // Calculate token amount
        let token_price_usd = sale_config.token_price_usd;
        let sol_amount_usd = sol_amount as f64 / 10_f64.powf(9.0) * sol_price_usd;
        let decimals = sale_config.mint_decimals;
        // // let mint: spl_token::state::Mint = spl_token::state::Mint::unpack(&ctx.accounts.mint.data.borrow())?;
        let token_amount = (sol_amount_usd / token_price_usd * 10_f64.powf(decimals as f64)) as u64;

         msg!("Attempting to transfer {} tokens", token_amount);

          let program_token_balance = ctx.accounts.program_token_account.amount;
    msg!("Program token balance: {}", program_token_balance);
    require!(program_token_balance >= token_amount, ErrorCode::InsufficientTokens);

        // Transfer SOL to sale authority
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.sale_authority.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, sol_amount)?;


  // Create static seeds and bump array
    let authority_seeds: &[&[u8]] = &[
        SALE_AUTHORITY,
        &[ctx.bumps.program_sale_authority],
    ];

    // Transfer tokens from program account to buyer with PDA signer
    anchor_spl::token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::Transfer {
                from: ctx.accounts.program_token_account.to_account_info(),
                to: ctx.accounts.buyer_token_account.to_account_info(),
                authority: ctx.accounts.program_sale_authority.to_account_info(),
            },
            &[authority_seeds]
        ),
        token_amount
    )?;
          let program_token_post_balance = ctx.accounts.program_token_account.amount;
    msg!("Program token post balance: {}", program_token_post_balance);
    Ok(())
    }

    pub fn withdraw_sol(ctx: Context<WithdrawSol>, amount: u64) -> Result<()> {
        let sale_config = &ctx.accounts.sale_config;
        require!(
            sale_config.authority == ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );

        let current_balance = ctx.accounts.sale_authority.lamports();
        require!(current_balance >= amount, ErrorCode::InsufficientFunds);

        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.sale_authority.to_account_info(),
                to: ctx.accounts.recipient.to_account_info(),
            },
        );

        anchor_lang::system_program::transfer(cpi_context, amount)?;

        Ok(())
    }

    pub fn pause_sale(ctx: Context<AdminControl>) -> Result<()> {
        let sale_config = &mut ctx.accounts.sale_config;
        sale_config.paused = true;
        Ok(())
    }

    pub fn resume_sale(ctx: Context<AdminControl>) -> Result<()> {
        let sale_config = &mut ctx.accounts.sale_config;
        sale_config.paused = false;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(sol_amount: u64)]
pub struct BuyTokens<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(mut)]
    pub sale_authority: SystemAccount<'info>, // This is the the sale authority, to whom, the SOL will be transferred

    #[account(
        mut,
        seeds = [SALE_AUTHORITY],
        bump
    )]
    pub program_sale_authority: SystemAccount<'info>, // This is the PDA, which will be used for transfering the tokens, to the buyers account

    #[account(
        constraint = sale_config.authority == authority.key() @ ErrorCode::Unauthorized,
        constraint = sale_config.sale_authority == program_sale_authority.key() @ ErrorCode::WrongProgramAuthority,
        constraint = sale_config.recipient == sale_authority.key() @ ErrorCode::WrongRecipientAddress
    )]  
    pub sale_config: Account<'info, SaleConfig>,

    /// CHECK: We only need the public key for verification
    pub authority: UncheckedAccount<'info>,  // This is the owner account, i.e the pause/resume authority

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = program_sale_authority
    )]
    pub program_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    pub price_update: Account<'info, PriceUpdateV2>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct WithdrawSol<'info> {
    #[account(
        mut,
        constraint = sale_config.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub sale_config: Account<'info, SaleConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub sale_authority: SystemAccount<'info>,

    /// CHECK: Recipient account where SOL will be withdrawn
    #[account(mut)]
    pub recipient: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeSale<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,   

    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 1 + 8 + 32 +32,
    )]
    pub sale_config: Account<'info, SaleConfig>,

    #[account(mut)]
    pub recipient: SystemAccount<'info>, // This is the the sale authority, to whom, the SOL will be transferred

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminControl<'info> {
    #[account(mut, has_one = authority)]
    pub sale_config: Account<'info, SaleConfig>,
    pub authority: Signer<'info>,
}

#[account]
pub struct SaleConfig {
    pub authority: Pubkey, // This is the authority that controls the pause and resume of the sale
    pub token_price_usd: f64,
    pub paused: bool,
    pub mint_decimals: u64,
    pub sale_authority: Pubkey, // This is the PDA which will be used to transfer tokens to 
    pub recipient: Pubkey,  // This is the account that will receive the SOL
}
