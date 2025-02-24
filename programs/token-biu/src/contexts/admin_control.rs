use anchor_lang::prelude::*;
use crate::{events::*, states::*};

#[derive(Accounts)]

    pub struct AdminControl<'info> {

    #[account(mut, has_one = authority)]
    pub sale_config: Account<'info, SaleConfig>,

    pub authority: Signer<'info>,
}

impl<'info> AdminControl<'info> {
    pub fn change_recipient(&mut self, new_recipient: Pubkey) -> Result<()> {

        let old_recipient = self.sale_config.recipient;
        self.sale_config.recipient = new_recipient;

        emit!(RecipientChanged {
            old_recipient,
            new_recipient,
        });

        Ok(())
    }

    pub fn change_authority(&mut self, new_authority: Pubkey) -> Result<()> {

        let old_authority = self.sale_config.authority;
        self.sale_config.authority = new_authority;

        emit!(TokenAuthorityChanged {
            old_authority,
            new_authority,
        });

        Ok(())
    }

    pub fn set_limit(&mut self, new_limit: u64) -> Result<()> {

        self.sale_config.wallet_purchase_limit = new_limit;

        emit!(WalletLimitSet {
            new_limit
        });

        Ok(())
    }

    pub fn pause(&mut self) -> Result<()> {

        self.sale_config.paused = true;

        Ok(())
    }

    pub fn resume(&mut self) -> Result<()> {

        self.sale_config.paused = false;

        Ok(())
    }

}
