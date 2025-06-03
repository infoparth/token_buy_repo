use anchor_lang::prelude::*;

// Event definitions
#[event]
pub struct SaleInitialized {
    pub authority: Pubkey,
    pub token_price: f64,
    pub recipient: Pubkey,
}

#[event]
pub struct TokensPurchased {
    pub buyer: Pubkey,
    pub sol_amount: u64,
    pub token_amount: u64,
    pub sol_price: f64,
}

#[event]
pub struct RecipientChanged {
    pub old_recipient: Pubkey,
    pub new_recipient: Pubkey,
}

#[event]
pub struct TokenAuthorityChanged {
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}

#[event]
pub struct WalletLimitSet {
	pub new_limit: u64,
	}
	
#[event]
pub struct MonthlyLimitsSet {
    pub limits: [u64; 14],
    pub timestamps: [i64; 14],
}

#[event]
pub struct VestingEnabled {
    pub vesting: bool,
}

#[event]
pub struct VestingDisabled {
    pub vesting: bool,
}

#[event]
pub struct AdminWithdrawnTokens {
    pub tokens_withdrawn: u64,
}

#[event]
pub struct BulkAirdropCompleted {
    pub recipient_count: u32,
    pub total_amount: u64,
    pub timestamp: i64,
}

