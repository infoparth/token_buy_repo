use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Token sale is currently paused")]
    SalePaused,

    #[msg("Unauthorized to perform this action")]
    Unauthorized,

    #[msg("Insufficient funds for withdrawal")]
    InsufficientFunds,

    #[msg("Invalid Pyth feed ID")]
    InvalidPythFeedId,

    #[msg("Insufficient tokens in program account")]
    InsufficientTokens,

    #[msg("Wrong Program authority")]
    WrongProgramAuthority,

    #[msg("Wrong Recipient Address for SOL Transfer")]
    WrongRecipientAddress,
}

