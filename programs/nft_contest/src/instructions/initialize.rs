use crate::common::lib::ErrorCode;
use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub program_owner: Signer<'info>,
    #[account(
        init,
        seeds = [b"counter".as_ref()],
        bump,
        payer = program_owner,
        space = 8 + std::mem::size_of::<Counter>()
    )]
    pub counter: Box<Account<'info, Counter>>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    if ctx.accounts.counter.is_initialized != true {
        ctx.accounts.counter.is_initialized = true;
        ctx.accounts.counter.contest_count = 0;
        Ok(())
    } else {
        Err(error!(ErrorCode::CounterAlreadyInitialized))
    }
}
