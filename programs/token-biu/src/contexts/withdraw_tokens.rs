use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};
use crate::{events::*, states::*, constants::*, error::ErrorCode};

#[derive(Accounts)]
pub struct WithdrawTokens<'info> {

    #[account(has_one = authority)]
    pub sale_config: Account<'info, SaleConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub monthly_limits: Account<'info, MonthlyLimits>,

    pub token_program: Program<'info, Token>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = program_sale_authority
    )]
    pub program_token_account: Account<'info, TokenAccount>,

    #[account(
            seeds = [SALE_AUTHORITY],
            bump = sale_config.bump,
    )]
    pub program_sale_authority: SystemAccount<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = authority,
    )]
    pub admin_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,

    pub associated_token_program: Program<'info, AssociatedToken>,

}

impl<'info> WithdrawTokens<'info> {
    pub fn withdraw_remaining_tokens(&mut self, token_amount: u64) -> Result<()>{

        require!(token_amount <= self.monthly_limits.tokens_available, ErrorCode::WithdrawLimitExceeded);

        self.transfer_tokens_to_admin(token_amount)?;

        self.update_state(token_amount)?;

        emit!(AdminWithdrawnTokens {
            tokens_withdrawn: token_amount,
        });

        Ok(())

    }

    /// Transfer tokens from program to admin
    fn transfer_tokens_to_admin(&self, token_amount: u64) -> Result<()> {

        let authority_seeds: &[&[u8]] = &[
            SALE_AUTHORITY,
            &[self.sale_config.bump],
        ];

        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: self.program_token_account.to_account_info(),
                    to: self.admin_token_account.to_account_info(),
                    authority: self.program_sale_authority.to_account_info(),
                },
                &[authority_seeds]
            ),
            token_amount
        )?;

        Ok(())
    }

    /// Update state after purchase
    fn update_state(&mut self, token_amount: u64) -> Result<()> {

        self.monthly_limits.tokens_unlocked += token_amount;
        self.monthly_limits.tokens_withdrawn += token_amount;
        self.monthly_limits.tokens_available -= token_amount;

        Ok(())
    }
}
