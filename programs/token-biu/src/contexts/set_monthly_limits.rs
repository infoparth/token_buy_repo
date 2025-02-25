use anchor_lang::prelude::*;
use crate::{states::*, events::*, constants::*};

#[derive(Accounts)]
pub struct SetMonthlyLimits<'info> {

    #[account(mut, has_one = authority)]
    pub sale_config: Box<Account<'info, SaleConfig>>,

    #[account(
        init_if_needed,
        payer = authority,
        space = MONTHLY_LIMITS_SIZE,
        seeds = [b"monthly_limits"],
        bump,
    )]
    pub monthly_limits: Box<Account<'info, MonthlyLimits>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> SetMonthlyLimits<'info> {
    pub fn set_limits(&mut self, limits: [u64; 14], timestamps: [i64; 14]) -> Result<()> {


        self.monthly_limits.limits = limits;
        self.monthly_limits.timestamps = timestamps;
        self.monthly_limits.tokens_unlocked = DEFAULT;
        self.monthly_limits.is_vesting_enabled = true;
        self.monthly_limits.tokens_available = DEFAULT;

        emit!(MonthlyLimitsSet {
            limits: self.monthly_limits.limits,
            timestamps: self.monthly_limits.timestamps,
        });

        emit!(VestingEnabled {
            vesting: true,
        });

        Ok(())
    }
}
