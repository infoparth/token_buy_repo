use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};
use crate::{states::*, events::*, constants::*, error::ErrorCode};

#[derive(Accounts)]
#[instruction(sol_amount: u64)]
pub struct BuyTokens<'info> {

    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(mut)]
    pub sale_authority: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [SALE_AUTHORITY],
        bump = sale_config.bump,
    )]
    pub program_sale_authority: SystemAccount<'info>,


    #[account(
        constraint = sale_config.authority == authority.key() @ ErrorCode::Unauthorized,
        constraint = sale_config.sale_authority == program_sale_authority.key() @ ErrorCode::WrongProgramAuthority,
        constraint = sale_config.recipient == sale_authority.key() @ ErrorCode::WrongRecipientAddress,
        constraint = sale_config.token_mint == mint.key() @ ErrorCode::InvalidTokenMint
    )]  
    pub sale_config: Box<Account<'info, SaleConfig>>,

    /// CHECK: We only need the public key for verification
    pub authority: UncheckedAccount<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = program_sale_authority
    )]
    pub program_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        space = WALLET_PURCHASE_SIZE,
        seeds = [b"wallet_purchase", buyer.key().as_ref()],
        bump,
    )]
    pub wallet_purchase: Box<Account<'info, WalletPurchase>>,

    #[account(mut)]
    pub monthly_limits: Box<Account<'info, MonthlyLimits>>,

    pub price_update: Box<Account<'info, PriceUpdateV2>>,

    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, Token>,

    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> BuyTokens<'info> {
    pub fn buy(&mut self, sol_amount: u64) -> Result<()> {

        let current_timestamp = Clock::get()?.unix_timestamp;

        self.check_sale_paused()?;
        self.initialize_wallet_purchase_if_needed()?;

        let sol_price_usd = self.get_sol_price_usd()?;
        let token_amount = self.calculate_token_amount(sol_amount, sol_price_usd)?;

        self.check_wallet_purchase_limits(token_amount, current_timestamp)?;
        self.check_monthly_limits(token_amount, current_timestamp)?;

        self.transfer_sol(sol_amount)?;
        self.transfer_tokens(token_amount)?;

        self.update_state(token_amount, current_timestamp)?;

        self.emit_purchase_event(sol_amount, token_amount, sol_price_usd)?;

        Ok(())
    }

    /// Check if the sale is paused
    fn check_sale_paused(&self) -> Result<()> {

        require!(!self.sale_config.paused, ErrorCode::SalePaused);

        Ok(())
    }

    /// Initialize wallet purchase if needed
    fn initialize_wallet_purchase_if_needed(&mut self) -> Result<()> {

        if self.wallet_purchase.wallet == Pubkey::default() {
            self.wallet_purchase.wallet = self.buyer.key();
            self.wallet_purchase.total_purchased = DEFAULT;
            self.wallet_purchase.last_purchased_timestamp = DEFAULT as i64;
        }

        Ok(())
    }

    /// Get SOL/USD price from Pyth
    fn get_sol_price_usd(&self) -> Result<f64> {

        let feed_id = get_feed_id_from_hex(SOL_USD_FEED_ID)?;
        let price_data = self.price_update.get_price_no_older_than(
            &Clock::get()?,
            MAX_AGE,
            &feed_id,
        )?;
        let sol_price_usd = (price_data.price as f64) * 10f64.powi(price_data.exponent);

        Ok(sol_price_usd)
    }

    /// Calculate token amount based on SOL amount and price
    fn calculate_token_amount(&self, sol_amount: u64, sol_price_usd: f64) -> Result<u64> {

        let token_price_usd = self.sale_config.token_price_usd;
        let sol_amount_usd = sol_amount as f64 / 10_f64.powf(SOL_DECIMALS) * sol_price_usd;
        let decimals = self.sale_config.mint_decimals;
        let token_amount = (sol_amount_usd / token_price_usd * 10_f64.powf(decimals as f64)) as u64;

        require!(self.program_token_account.amount >= token_amount, ErrorCode::InsufficientTokens);

        Ok(token_amount)
    }

    /// Check wallet purchase limits
    fn check_wallet_purchase_limits(&mut self, token_amount: u64, current_timestamp: i64) -> Result<()> {

        if current_timestamp - self.wallet_purchase.last_purchased_timestamp > SECONDS_IN_A_DAY {
            self.wallet_purchase.total_purchased = DEFAULT;
        }

        require!(
            self.wallet_purchase.total_purchased + token_amount <= self.sale_config.wallet_purchase_limit,
            ErrorCode::PurchaseLimitExceeded
        );

        Ok(())
    }

    /// Check monthly limits
    fn check_monthly_limits(&mut self, token_amount: u64, current_timestamp: i64) -> Result<()> {

        if !self.monthly_limits.is_vesting_enabled{

            return Ok(());
        }

        let this_month = ((current_timestamp / PERIOD_LENGTH) % PERIOD_COUNT) as u8;

        if current_timestamp <= YEAR1_END{
            self.check_monthly_limits_for_first_year(token_amount, this_month)
        }
        else{
            self.check_monthly_limits_for_second_year(token_amount, this_month)
        }
    }

        

    /// Check monthly limits for first year
    fn check_monthly_limits_for_first_year(&self, token_amount: u64, this_month: u8) -> Result<()>{

        let starting_month = self.monthly_limits.starting_month;

        let tokens_to_be_unlocked_this_year = self.monthly_limits.total_locked / 2;
 
        let monthly_limits_variable: u64 = (MONTHS_IN_A_YEAR - this_month) as u64 * self.monthly_limits.limits[(this_month - starting_month) as usize];

        let tokens_unlocked_so_far: u64 = self.monthly_limits.tokens_unlocked;



          if tokens_to_be_unlocked_this_year < monthly_limits_variable {
                        msg!("Overflow detected: tokens_to_be_unlocked_this_year < monthly_limits_variable");
                        return Err(ErrorCode::InvalidCalculation.into());
                    }

                let remaining_tokens = tokens_to_be_unlocked_this_year
                    .checked_sub(monthly_limits_variable)
                        .ok_or(ErrorCode::InvalidCalculation)?;

                if remaining_tokens < tokens_unlocked_so_far {
                        msg!("Overflow detected: remaining_tokens < tokens_unlocked_so_far");
                        return Err(ErrorCode::InvalidCalculation.into());
                    }

                let tokens_available_this_month = remaining_tokens
                    .checked_sub(tokens_unlocked_so_far)
                        .ok_or(ErrorCode::InvalidCalculation)?;
        require!(
            token_amount <= tokens_available_this_month,
            ErrorCode::MonthlyLimitExceeded
        );

        Ok(())

    }

    /// Check monthly limits for second year
    fn check_monthly_limits_for_second_year(&self, token_amount: u64, this_month: u8) -> Result<()>{

        // this is for the first six months period of the second year
        if this_month < SEPTEMBER{  

        let total_tokens_locked = self.monthly_limits.total_locked ;

        let monthly_limits_variable: u64 = self.monthly_limits.limits[FIRST_HALF];

        let tokens_unlocked_so_far: u64 = self.monthly_limits.tokens_unlocked;

          if total_tokens_locked < monthly_limits_variable {
                        msg!("Overflow detected: total_tokens_locked < monthly_limits_variable");
                        return Err(ErrorCode::InvalidCalculation.into());
                    }

                let remaining_tokens = total_tokens_locked
                    .checked_sub(monthly_limits_variable)
                        .ok_or(ErrorCode::InvalidCalculation)?;

                if remaining_tokens < tokens_unlocked_so_far {
                        msg!("Overflow detected: remaining_tokens < tokens_unlocked_so_far");
                        return Err(ErrorCode::InvalidCalculation.into());
                    }

                let tokens_available_to_buy = remaining_tokens
                    .checked_sub(tokens_unlocked_so_far)
                        .ok_or(ErrorCode::InvalidCalculation)?;

        require!(
            token_amount <= tokens_available_to_buy,
            ErrorCode::MonthlyLimitExceeded
        );

        Ok(())

        }

        // This is for the second six months period of the second year
        else{

        let total_tokens_locked = self.monthly_limits.total_locked ;

        let tokens_unlocked_so_far: u64 = self.monthly_limits.tokens_unlocked;


          if total_tokens_locked < tokens_unlocked_so_far {
                        msg!("Overflow detected: total_tokens_locked < tokens_unlocked_so_far");
                        return Err(ErrorCode::InvalidCalculation.into());
                    }

                let tokens_available_to_buy = total_tokens_locked
                    .checked_sub(tokens_unlocked_so_far)
                        .ok_or(ErrorCode::InvalidCalculation)?;

        require!(
            token_amount <= tokens_available_to_buy,
            ErrorCode::MonthlyLimitExceeded
        );

        Ok(())

        }
    }

    /// Transfer SOL from buyer to sale authority
    fn transfer_sol(&self, sol_amount: u64) -> Result<()> {

        let cpi_context = CpiContext::new(
            self.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: self.buyer.to_account_info(),
                to: self.sale_authority.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, sol_amount)?;

        Ok(())
    }

    /// Transfer tokens from program to buyer
    fn transfer_tokens(&self, token_amount: u64) -> Result<()> {

        let authority_seeds: &[&[u8]] = &[
            SALE_AUTHORITY,
            &[self.sale_config.bump],
        ];

        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: self.program_token_account.to_account_info(),
                    to: self.buyer_token_account.to_account_info(),
                    authority: self.program_sale_authority.to_account_info(),
                },
                &[authority_seeds]
            ),
            token_amount
        )?;

        Ok(())
    }

    /// Update state after purchase
    fn update_state(&mut self, token_amount: u64, current_timestamp: i64) -> Result<()> {

        self.wallet_purchase.total_purchased += token_amount;
        self.wallet_purchase.last_purchased_timestamp = current_timestamp;
        self.monthly_limits.tokens_unlocked += token_amount;

        Ok(())
    }

    /// Emit purchase event
    fn emit_purchase_event(&self, sol_amount: u64, token_amount: u64, sol_price_usd: f64) -> Result<()> {
        emit!(TokensPurchased {
            buyer: self.buyer.key(),
            sol_amount,
            token_amount,
            sol_price: sol_price_usd,
        });

        Ok(())
    }
}
