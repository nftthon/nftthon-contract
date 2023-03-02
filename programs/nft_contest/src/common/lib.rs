use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Counter account is already initialized")]
    CounterAlreadyInitialized,
    CounterNotInitialized,
    Launch,
    Submit,
    Vote,
}
