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

    #[msg("Wrong Token Mint Address")]
    InvalidTokenMint,

    #[msg("Slippage Exceeds the desired amount")]
    SlippageExceeded, 

    #[msg("Math-Overflow error")]
    MathOverflow, 

    #[msg("Purchase Limit Exceeded")]
	  PurchaseLimitExceeded, 

	  #[msg("Monthly Limit Exceeded")]
	  MonthlyLimitExceeded, 

	  #[msg("Invalid Calculation Error")]
    InvalidCalculation,

	  #[msg("Sale Not Started Yet")]
    SaleNotStarted,

	  #[msg("The Withdraw Limit has exceeded")]
    WithdrawLimitExceeded,

     #[msg("Number of amounts does not match number of recipient accounts.")]
    AmountRecipientMismatch,

    #[msg("No recipients provided.")]
    NoRecipients,

    #[msg("Source token account mint does not match the provided token mint.")]
    SourceMintMismatch,

    #[msg("Recipient token account mint does not match the provided token mint.")]
    RecipientMintMismatch,

    #[msg("PDA is not the authority for the source token account.")]
    InvalidAuthority,

    #[msg("Cannot airdrop zero tokens.")]
    ZeroAmount,

    #[msg("Recipient account must be writable.")]
    RecipientNotWritable,

    #[msg("Recipient account must be owned by the SPL Token program.")]
    RecipientNotTokenAccount,

    #[msg("Source account cannot be the recipient account.")]
    SourceIsRecipient,

    #[msg("Not enough balance for airdrop.")]
    InsufficientVaultBalance,

}

