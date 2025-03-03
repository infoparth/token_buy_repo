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
            Period::Hourly => 12,
            Period::Daily => 12,
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
pub const MONTHS_IN_A_YEAR: u8 = 12;

// Decimal constants
pub const SOL_DECIMALS: f64 = 9.0; // SOL has 9 decimal places

// Space constants
pub const MONTHLY_LIMITS_SIZE: usize = 8 + (8 * 14) + (8 * 14) + 8 + 8 + 8 + 1 + 1 ; // Size of MonthlyLimits account
pub const WALLET_PURCHASE_SIZE: usize = 8 + 32 + 8 + 8 + 1; // Size of WalletPurchase account
pub const SALE_CONFIG_SIZE: usize = 8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 1; // Size of SaleConfig account

// Vesting schedule constants
pub const YEAR1_START: i64 = 1735689600; // March 1, 2025
pub const YEAR1_END: i64 = 1767225600;   // March 1, 2026
pub const YEAR2_END: i64 = 1783296000;   // September 1, 2026
pub const MONTHLY_UNLOCK: u64 = 2_660_000; // 2.66 million $LAL per month
pub const BULK_UNLOCK: u64 = 64_000_000;   // 64 million $LAL
pub const MARCH: i64 = 3;
pub const SEPTEMBER: u8 = 9;
pub const FIRST_HALF: usize = 12;
pub const SECOND_HALF: usize = 13;

