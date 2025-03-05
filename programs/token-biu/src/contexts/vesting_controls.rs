
use anchor_lang::prelude::*;
use crate::{events::*, states::* };

#[derive(Accounts)]

    pub struct VestingControl<'info> {

    #[account(has_one = authority)]
    pub sale_config: Account<'info, SaleConfig>,

    pub authority: Signer<'info>,

    
    #[account(mut)]
    pub monthly_limits: Account<'info, MonthlyLimits>,

}

impl<'info> VestingControl<'info> {
    pub fn enable_vesting(&mut self) -> Result<()> {

        self.monthly_limits.is_vesting_enabled = true;
        
        emit!(VestingEnabled {
            vesting: true,
        });

        Ok(())
    }

    pub fn disable_vesting(&mut self) -> Result<()> {

        self.monthly_limits.is_vesting_enabled = false;

        emit!(VestingDisabled {
            vesting: false,
        });

        Ok(())
    }

}
