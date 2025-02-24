use anchor_lang::prelude::*;

#[account]
pub struct SaleConfig {
    pub authority: Pubkey,
    pub sale_authority: Pubkey,
    pub recipient: Pubkey,
    pub token_mint: Pubkey,
    pub token_price_usd: f64,
    pub mint_decimals: u64,
    pub wallet_purchase_limit: u64,
    pub bump: u8,
    pub paused: bool,
}

#[account]
pub struct WalletPurchase {
    pub wallet: Pubkey,
    pub total_purchased: u64,
    pub last_purchased_timestamp: i64,
    pub bump: u8,
}

#[account]
pub struct MonthlyLimits {
    pub limits: [u64; 14],
    pub total_locked: u64,          // Total tokens locked (160 million)
    pub tokens_unlocked: u64,       // Tokens unlocked so far
    pub starting_month: u8,
    pub is_vesting_enabled: bool,
}

