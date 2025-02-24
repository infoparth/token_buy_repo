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
    pub fn set_limits(&mut self, limits: [u64; 14], total_locked_for_first_year: u64, total_locked_for_second_year: u64) -> Result<()> {

        let current_timestamp = Clock::get()?.unix_timestamp;
        let this_month = ((current_timestamp / PERIOD_LENGTH) % PERIOD_COUNT) as u8;

        self.monthly_limits.limits = limits;
        self.monthly_limits.starting_month = this_month;
        self.monthly_limits.total_locked_in_first_year = total_locked_for_first_year;
        self.monthly_limits.total_locked_in_second_year = total_locked_for_second_year;
        self.monthly_limits.tokens_unlocked = DEFAULT;
        self.monthly_limits.is_vesting_enabled = true;

        emit!(MonthlyLimitsSet {
            limits: self.monthly_limits.limits,
        });

        emit!(VestingEnabled {
            vesting: true,
        });

        Ok(())
    }
}
