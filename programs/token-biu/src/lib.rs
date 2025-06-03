use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Mint, Token, TokenAccount, Transfer},
};
use crate::{states::*, events::*, constants::*, error::ErrorCode};

pub mod constants;
pub mod contexts;
pub mod error;
pub mod events;
pub mod states;


use contexts::*;

declare_id!("6LUVNKtbT9a86zoJRCgh8wKBNphcFexBe1uo353jS5mb");

#[program]
pub mod token_biu {
    use super::*;

    pub fn initialize_sale(
        ctx: Context<InitializeSale>,
        token_price_usd: f64,
        mint_decimals: u64,
        purchase_limit: u64,
    ) -> Result<()> {
        ctx.accounts.initialize(token_price_usd, mint_decimals, purchase_limit)
    }

    pub fn buy_tokens(ctx: Context<BuyTokens>, sol_amount: u64) -> Result<()> {
        ctx.accounts.buy(sol_amount)
    }

    pub fn change_reciepent_account(ctx: Context<AdminControl>, new_receipent: Pubkey) -> Result<()> {
        ctx.accounts.change_recipient(new_receipent)
    }

    pub fn change_config_authority(ctx: Context<AdminControl>, new_authority: Pubkey) -> Result<()> {
        ctx.accounts.change_authority(new_authority)
    }

    pub fn set_purchase_limit(ctx: Context<AdminControl>, new_limit: u64) -> Result<()> {
        ctx.accounts.set_limit(new_limit)
    }

    pub fn pause_sale(ctx: Context<AdminControl>) -> Result<()> {
        ctx.accounts.pause()
    }

    pub fn resume_sale(ctx: Context<AdminControl>) -> Result<()> {
        ctx.accounts.resume()
    }

    pub fn set_monthly_limits(ctx: Context<SetMonthlyLimits>, limits: [u64; 14], timestamps: [i64; 14]) -> Result<()> {
        ctx.accounts.set_limits(limits, timestamps)
    }

    pub fn enable_vesting(ctx: Context<VestingControl>) -> Result<()> {
        ctx.accounts.enable_vesting()
    }

    pub fn disable_vesting(ctx: Context<VestingControl>) -> Result<()> {
        ctx.accounts.disable_vesting()
    }

    pub fn withdraw_tokens(ctx: Context<WithdrawTokens>, token_amount: u64) -> Result<()> {
        ctx.accounts.withdraw_remaining_tokens(token_amount)
    }

     pub fn tx_from_pda(ctx: Context<BulkOperation>, amounts: Vec<u64>) -> Result<()> {
        // let remaining_accounts = ctx.accounts.remaining_accounts;
        ctx.accounts.transferTokens(ctx.remaining_accounts, amounts)
        // BulkAirdrop::airdrop(ctx, amounts)
        // let source_token_account = &ctx.accounts.sale_token_vault;
        //  let token_program = &ctx.accounts.token_program;
        //  let pda_authority = &ctx.accounts.program_airdrop_authority;
        //  let token_mint_key = ctx.accounts.token_mint.key();
        //
        //  // --- Validation ---
        //  require!(
        //    amounts.len() == ctx.remaining_accounts.len(),
        //    ErrorCode::AmountRecipientMismatch
        //  );
        //  require!(!amounts.is_empty(), ErrorCode::NoRecipients);
        //  // Mint and authority constraints are checked in the AirdropFromPda Accounts struct
        //
        //  // --- PDA Signer Seeds --- //
        //  let (_pda_address, bump_seed) = Pubkey::find_program_address(&[AIRDROP_AUTHORITY], ctx.program_id);
        //  let seeds = &[&AIRDROP_AUTHORITY[..], &[bump_seed]];
        //  let signer_seeds = &[&seeds[..]];
        //
        //  // --- Iterate and Transfer --- //
        //  // Looping directly over ctx.remaining_accounts within the instruction handler
        //  // is the standard way to avoid lifetime complexities.
        //  let source_account_info = source_token_account.to_account_info();
        //  let pda_authority_info = pda_authority.to_account_info();
        //
        //  for (i, recipient_account_info) in ctx.remaining_accounts.iter().enumerate() {
        //    let amount = amounts[i];
        //    require!(amount > 0, ErrorCode::ZeroAmount);
        //
        //    // Basic checks
        //    require!(recipient_account_info.is_writable, ErrorCode::RecipientNotWritable);
        //    require!(recipient_account_info.key() != source_account_info.key(), ErrorCode::SourceIsRecipient);
        //
        //    // Security Check: Verify recipient is a valid Token Account of the correct mint
        //    // This check is crucial when dealing with remaining_accounts which are unchecked AccountInfos.
        //    require!(recipient_account_info.owner == token_program.key, ErrorCode::RecipientNotTokenAccount);
        //    let recipient_token_account_data = recipient_account_info.try_borrow_data()?;
        //    // Check bytes 32-64 for the mint pubkey within SPL Token account data structure
        //    let recipient_mint_slice = &recipient_token_account_data[32..64];
        //    require!(recipient_mint_slice == token_mint_key.as_ref(), ErrorCode::RecipientMintMismatch);
        //    // Drop the borrow manually after use
        //    drop(recipient_token_account_data);
        //
        //    // --- Perform CPI Transfer with PDA signer --- //
        //    let cpi_accounts = Transfer {
        //        from: source_account_info.clone(),
        //        to: recipient_account_info.clone(),
        //        authority: pda_authority_info.clone(), // PDA is the authority
        //    };
        //
        //    let cpi_context = CpiContext::new_with_signer(
        //        token_program.to_account_info(),
        //        cpi_accounts,
        //        signer_seeds, // Pass PDA seeds
        //    );
        //
        //    token::transfer(cpi_context, amount)?;
        //  }
        //
        //  msg!("Airdrop completed successfully for {} recipients.", amounts.len());
        //  Ok(())
    }
}
