use anchor_lang::prelude::*;

#[constant]
pub const SOL_USD_FEED_ID: &str =
    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

pub const SALE_AUTHORITY: &[u8] = b"SALE_AUTHORITY";

pub const ANCHOR_DISCRIMINATOR: usize = 8;
pub const MAX_AGE: u64 = 100;
pub const PRICE_FEED_DECIMAL_ADJUSTMENT: u128 = 10;
pub const SECONDS_IN_A_DAY: i64 = 24 * 60 * 60;

// Define an enum for the periods
#[derive(Debug, Clone, Copy)]
pub enum Period {
    Hourly,
    Daily,
    Monthly,
}

impl Period {
    // Method to get the length of the period in seconds
    pub const  fn length(&self) -> i64 {
        match self {
            Period::Hourly => 3600,
            Period::Daily => 86400,
            Period::Monthly => 2629743,
        }
    }

    // Method to get the count of periods in a year
    pub const fn count(&self) -> i64 {
        match self {
            Period::Hourly => 8760,
            Period::Daily => 365,
            Period::Monthly => 12,
        }
    }
}

// Use the enum to define the constants

/*

Period::Monthly => For monthly periods ~30.44 days
Period::Daily => For daily periods - 24 hours
Period::Hourly => For hourly periods - 1 hour

*/

pub const PERIOD: Period = Period::Monthly;

pub const PERIOD_LENGTH: i64 = PERIOD.length();
pub const PERIOD_COUNT: i64 = PERIOD.count();

pub const DEFAULT: u64 = 0;

// Decimal constants
pub const SOL_DECIMALS: f64 = 9.0; // SOL has 9 decimal places

// Space constants
pub const MONTHLY_LIMITS_SIZE: usize = 8 + (8 * 12) + 8 + 1; // Size of MonthlyLimits account
pub const WALLET_PURCHASE_SIZE: usize = 8 + 32 + 8 + 8 + 1; // Size of WalletPurchase account
pub const SALE_CONFIG_SIZE: usize = 8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 1; // Size of SaleConfig account
