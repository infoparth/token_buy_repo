use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Mint, Token, TokenAccount, Transfer},
};
use crate::{states::*, events::*, constants::*, error::ErrorCode};


#[derive(Accounts)]

    pub struct BulkOperation<'info> {
        #[account(mut)]
        pub authority: Signer<'info>,

        #[account(
            mut,
            seeds = [AIRDROP_AUTHORITY],
            bump = sale_config.airdrop_bump,
        )]
        pub program_airdrop_authority: AccountInfo<'info>,

        #[account(
            constraint = sale_config.authority == authority.key() @ ErrorCode::Unauthorized,
            constraint = sale_config.airdrop_authority == program_airdrop_authority.key() @ ErrorCode::WrongProgramAuthority,
            constraint = sale_config.token_mint == token_mint.key() @ ErrorCode::InvalidTokenMint
        )]  
        pub sale_config: Box<Account<'info, SaleConfig>>,

        #[account(
            mut,
            constraint = token_mint.key() == sale_config.token_mint
        )]
        pub token_mint: Account<'info, Mint>,

        #[account (
            mut,
            associated_token::mint = token_mint,
            associated_token::authority = program_airdrop_authority
        )]
        pub sale_token_vault: Account<'info, TokenAccount>,

        pub token_program: Program<'info, Token>,

        pub system_program: Program<'info, System>,

    }

        impl<'info> BulkOperation<'info>{
            pub fn transferTokens(&mut self, remaining_accounts: &'info[AccountInfo<'info>], amounts: Vec<u64>) -> Result<()>{

                require!(amounts.len() == remaining_accounts.len() , ErrorCode::AmountRecipientMismatch);

                require!(!amounts.is_empty(), ErrorCode::NoRecipients);

                let source_account_info = self.sale_token_vault.to_account_info();

                let total_amount: u64 = amounts.iter().sum();

                // let program_id = &self.program_id;

                require!(self.sale_token_vault.amount >= total_amount,
                ErrorCode:: InsufficientVaultBalance);

                let clock = Clock::get()?;

                for (i, recipient_account_info) in remaining_accounts.iter().enumerate(){
                    let amount = amounts[i];
                    require!(amount > 0, ErrorCode::ZeroAmount);

                    require!(recipient_account_info.is_writable, ErrorCode::RecipientNotWritable);

                    require!(recipient_account_info.owner == self.token_program.key, ErrorCode::RecipientNotTokenAccount);

                    let recipient_token_account_data = recipient_account_info.try_borrow_data()?;
                    let recipient_mint_slice = &recipient_token_account_data[32..64];
                    require!(recipient_mint_slice == self.token_mint.key().as_ref(), ErrorCode::RecipientMintMismatch);
                    drop(recipient_token_account_data);


                    // self.transfer_tokens(&recipient_account_info, amount, &program_id)?;

                //     let(_pda_address, bump) = Pubkey::find_program_address(&[AIRDROP_AUTHORITY], &program_id);
                let seeds = &[&AIRDROP_AUTHORITY[..], &[self.sale_config.airdrop_bump]];
                let signer_seeds = &[&seeds[..]];

                let cpi_accounts = Transfer{
                    from: source_account_info.clone(),
                    to: recipient_account_info.clone(),
                    authority: self.program_airdrop_authority.clone()
                };

                let cpi_context = CpiContext::new_with_signer(
                    self.token_program.to_account_info(),
                    cpi_accounts,
                signer_seeds,

                );

                token::transfer(cpi_context, amount)?;

                }

                emit!(BulkAirdropCompleted{
                    recipient_count: amounts.len() as u32,
                    total_amount,
                    timestamp: clock.unix_timestamp
                });

                Ok(())

            }

            // fn transfer_tokens(&self, recipient: &AccountInfo, token_amount: u64, program_id: &Pubkey) -> Result<()> {

            //     let(_pda_address, bump) = Pubkey::find_program_address(&[AIRDROP_AUTHORITY], &program_id);
            //     let seeds = &[&AIRDROP_AUTHORITY[..], &[bump]];
            //     let signer_seeds = &[&seeds[..]];

            //     let cpi_accounts = Transfer{
            //         from: source_account_info.clone(),
            //         to: recipient.clone(),
            //         authority: self.program_airdrop_authority.clone()
            //     };

            //     let cpi_context = CpiContext::new_with_signer(
            //         self.token_program.to_account_info(),
            //         cpi_accounts,
            //         signer_seeds,
            //     );

            //     token::transfer(cpi_context, token_amount);

            //     // Change the authority seeds here-- and the sale_config.bump
            //     // let authority_seeds: &[&[u8]] = &[
            //     //     AIRDROP_AUTHORITY,
            //     //     &[self.sale_config.airdrop_bump],
            //     // ];

            //     // let signer_seeds = &[&authority_seeds[..]];

            //     // anchor_spl::token::transfer(
            //     //     CpiContext::new_with_signer(
            //     //         self.token_program.to_account_info(),
            //     //         anchor_spl::token::Transfer {
            //     //             from: self.sale_token_vault.clone(),
            //     //             to: recipient.clone(),
            //     //             authority: self.program_airdrop_authority.clone(),
            //     //         },
            //     //         &[authority_seeds]
            //     //     ),
            //     //     token_amount
            //     // )?;

            //     Ok(())
            // }
        }
