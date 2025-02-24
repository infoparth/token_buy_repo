use anchor_lang::prelude::*;
use anchor_spl::{
    
    token::{Mint},
};
use crate::{constants::*, events::*, states::*};

#[derive(Accounts)]
pub struct InitializeSale<'info> {

    #[account(mut)]
    pub authority: Signer<'info>,   

    #[account(
        init,
        payer = authority,
        space = SALE_CONFIG_SIZE,
    )]
    pub sale_config: Account<'info, SaleConfig>,

    #[account(mut)]
    pub recipient: SystemAccount<'info>,

    pub token_mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,

}

impl<'info> InitializeSale<'info> {
    pub fn initialize(&mut self, token_price_usd: f64, mint_decimals: u64, purchase_limit: u64) -> Result<()> {

        let (sale_authority, bump) = Pubkey::find_program_address(&[SALE_AUTHORITY], &crate::ID);
        let sale_config = &mut self.sale_config;

        sale_config.authority = self.authority.key();
        sale_config.token_price_usd = token_price_usd;
        sale_config.paused = false;
        sale_config.mint_decimals = mint_decimals;
        sale_config.sale_authority = sale_authority;
        sale_config.recipient = self.recipient.key();
        sale_config.token_mint = self.token_mint.key();
        sale_config.bump = bump;
        sale_config.wallet_purchase_limit = purchase_limit;

        emit!(SaleInitialized {
            authority: sale_config.authority,
            token_price: token_price_usd,
            recipient: sale_config.recipient,
        });

        Ok(())
    }
}
