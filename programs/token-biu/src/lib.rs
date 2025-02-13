pub mod error;
pub mod constants;
pub mod events;

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

use crate::error::ErrorCode;
use crate::constants::{
      MAX_AGE, SOL_USD_FEED_ID,SALE_AUTHORITY, SECONDS_IN_A_DAY, ANCHOR_DISCRIMINATOR
};
use events::*;

declare_id!("AuDZCMRLBovvSc3214tq4tPAnn16TtgMXE1dFSMkvRoe");

#[program]
pub mod token_biu {
    use super::*;

    pub fn initialize_sale(
        ctx: Context<InitializeSale>,
        token_price_usd: f64,
        mint_decimals: u64,
		purchase_limit: u64,
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
        sale_config.token_mint = ctx.accounts.token_mint.key();
        sale_config.bump = _bump;
		sale_config.wallet_purchase_limit = purchase_limit;

        // Emit initialization event
        emit!(SaleInitialized {
            authority: sale_config.authority,
            token_price: token_price_usd,
            recipient: sale_config.recipient,
        });

        Ok(())
    }

    pub fn buy_tokens(ctx: Context<BuyTokens>, sol_amount: u64) -> Result<()> {
        let sale_config = &ctx.accounts.sale_config;
        
        require!(!sale_config.paused, ErrorCode::SalePaused);


		let wallet_purchase = &mut ctx.accounts.wallet_purchase;
		let current_timestamp = Clock::get()?.unix_timestamp;

		// Check if account needs initialization (wallet will be default/zero if new)
    	if wallet_purchase.wallet == Pubkey::default() {

        	wallet_purchase.wallet = ctx.accounts.buyer.key();
        	wallet_purchase.total_purchased = 0;
        	wallet_purchase.last_purchased_timestamp = 0; // Start with 0 timestamp
    	}


        // Fetch SOL/USD price from Pyth
        let feed_id: [u8; 32] =
           get_feed_id_from_hex(SOL_USD_FEED_ID)?;
        let price_data = ctx.accounts.price_update.get_price_no_older_than(
            &Clock::get()?,
            MAX_AGE,
            &feed_id,
       )?;
      let sol_price_usd = (price_data.price as f64) * 10f64.powi(price_data.exponent);
        
   //    let sol_price_usd: f64 = 190.0;

        // Calculate token amount
        let token_price_usd = sale_config.token_price_usd;
        let sol_amount_usd = sol_amount as f64 / 10_f64.powf(9.0) * sol_price_usd;
        
        let decimals = sale_config.mint_decimals;
        let token_amount = (sol_amount_usd / token_price_usd * 10_f64.powf(decimals as f64)) as u64;

          let program_token_balance = ctx.accounts.program_token_account.amount;

            require!(program_token_balance >= token_amount, ErrorCode::InsufficientTokens);

			let wallet_daily_limit = sale_config.wallet_purchase_limit;

			if current_timestamp - wallet_purchase.last_purchased_timestamp > SECONDS_IN_A_DAY  {
			wallet_purchase.total_purchased = 0;
			}

			require!(wallet_purchase.total_purchased + token_amount <= wallet_daily_limit, 
			ErrorCode::PurchaseLimitExceeded

			);


		// Check monthly limits
    	let monthly_limits = &mut ctx.accounts.monthly_limits;
    	let new_month = ((current_timestamp / 2629743) % 12) as u8; // Approximate month calculation

		  // Check if we've moved to a new month
		if new_month != monthly_limits.current_month {
        	monthly_limits.tokens_bought_this_month = 0;
        	monthly_limits.current_month = new_month;
    	}


    	let monthly_limit = monthly_limits.limits[new_month as usize];
		let tokens_bought_this_month = monthly_limits.tokens_bought_this_month;

    	require!(token_amount + tokens_bought_this_month <= monthly_limit, ErrorCode::MonthlyLimitExceeded);

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
        &[sale_config.bump],
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

	wallet_purchase.total_purchased += token_amount;
	wallet_purchase.last_purchased_timestamp = current_timestamp;

	monthly_limits.tokens_bought_this_month  += token_amount;



     // Emit purchase event
        emit!(TokensPurchased {
            buyer: ctx.accounts.buyer.key(),
            sol_amount,
            token_amount,
            sol_price: sol_price_usd,
        });
    
    Ok(())
    }

    pub fn change_reciepent_account(ctx: Context<AdminControl>, new_receipent: Pubkey) -> Result<()>{
        
        let sale_config = &mut ctx.accounts.sale_config;
        sale_config.recipient = new_receipent;

        emit!(RecipientChanged {
            old_recipient: ctx.accounts.sale_config.recipient,
            new_recipient: new_receipent,
        });

        Ok(())
    }


     pub fn change_config_authority(ctx: Context<AdminControl>, new_authority: Pubkey) -> Result<()>{
        
        let sale_config = &mut ctx.accounts.sale_config;
        sale_config.authority = new_authority;

        emit!(TokenAuthorityChanged {
            old_authority: ctx.accounts.sale_config.authority,
            new_authority,
        });

        Ok(())
    }

	pub fn  set_purchase_limit(ctx: Context<AdminControl>,new_limit: u64 ) -> Result<()>{
		let sale_config = &mut ctx.accounts.sale_config;
		sale_config.wallet_purchase_limit = new_limit;


		emit!(WalletLimitSet{
		new_limit});

	
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


	pub fn set_monthly_limits(ctx: Context<SetMonthlyLimits>, limits: [u64; 12]) -> Result<()> {
    	let monthly_limits = &mut ctx.accounts.monthly_limits;
    	monthly_limits.limits = limits;
	

		let current_timestamp = Clock::get()?.unix_timestamp;

    	let this_month = ((current_timestamp / 2629743) % 12) as u8; // Approximate month calculation
        monthly_limits.tokens_bought_this_month = 0;
        monthly_limits.current_month = this_month;

    	emit!(MonthlyLimitsSet {
        	limits: monthly_limits.limits,
    	});

    	Ok(())
	}


#[derive(Accounts)]
pub struct InitializeSale<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,   

    #[account(
        init,
        payer = authority,
        space = ANCHOR_DISCRIMINATOR + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 1,
    )]
    pub sale_config: Account<'info, SaleConfig>,

    #[account(mut)]
    pub recipient: SystemAccount<'info>, // This is the the sale authority, to whom, the SOL will be transferred

    pub token_mint: Account<'info, Mint>, // This is the address of the token_mint that is being initialized

    pub system_program: Program<'info, System>,
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
        bump = sale_config.bump,
        
    )]
    pub program_sale_authority: SystemAccount<'info>, // This is the associated token account of the program 

    #[account(
        constraint = sale_config.authority == authority.key() @ ErrorCode::Unauthorized,
        constraint = sale_config.sale_authority == program_sale_authority.key() @ ErrorCode::WrongProgramAuthority,
        constraint = sale_config.recipient == sale_authority.key() @ ErrorCode::WrongRecipientAddress,
        constraint = sale_config.token_mint == mint.key() @ ErrorCode::InvalidTokenMint
    )]  
    pub sale_config: Box<Account<'info, SaleConfig>>,

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

	#[account(
        init_if_needed,
        payer = buyer,
        space = ANCHOR_DISCRIMINATOR + 32 + 8 + 8 +  1,
        seeds = [b"wallet_purchase", buyer.key().as_ref()],
        bump,
    )]
    pub wallet_purchase: Box<Account<'info, WalletPurchase>>,


	#[account(mut)]
    pub monthly_limits: Box<Account<'info, MonthlyLimits>>,


    pub price_update: Box<Account<'info, PriceUpdateV2>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}



#[derive(Accounts)]
pub struct AdminControl<'info> {
    #[account(mut, has_one = authority)]
    pub sale_config: Account<'info, SaleConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetMonthlyLimits<'info> {
    #[account(mut, has_one = authority)]
    pub sale_config: Box<Account<'info, SaleConfig>>,
    #[account(
        init_if_needed,
        payer = authority,
        space = ANCHOR_DISCRIMINATOR + (8 * 12) + 8 + 1,
        seeds = [b"monthly_limits"],
        bump,
    )]
    pub monthly_limits: Box<Account<'info, MonthlyLimits>>,

	#[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct SaleConfig {
    pub authority: Pubkey, // This is the authority that controls the pause and resume of the sale
    pub sale_authority: Pubkey, // This is the PDA which will be used to transfer tokens to 
    pub recipient: Pubkey,  // This is the account that will receive the SOL
    pub token_mint: Pubkey, // This is the address of the token mint, that will be used
    pub token_price_usd: f64,
    pub mint_decimals: u64,
	pub wallet_purchase_limit: u64,
    pub bump: u8,
	pub paused: bool,
    
}

#[account]
pub struct WalletPurchase {
    pub wallet: Pubkey,       // The wallet address
    pub total_purchased: u64, // Total tokens purchased by this wallet
	pub last_purchased_timestamp: i64, // The Timestamp of the last purchase	
    pub bump: u8,             // Bump seed for PDA
}

#[account]
pub struct MonthlyLimits {
    pub limits: [u64; 12], // Array to store the monthly limits for 12 months
	pub tokens_bought_this_month: u64,
	pub current_month: u8,
}

}
