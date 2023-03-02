use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, SetAuthority, Token, TokenAccount, Transfer};
use spl_token::instruction::AuthorityType;

#[derive(Accounts)]
#[instruction(contest_id: u64, vec_size: u8)]
pub struct Launch<'info> {
    #[account(mut)]
    pub contest_owner: Signer<'info>,
    #[account(mut,
      seeds = [b"counter"], bump)]
    pub counter: Account<'info, Counter>,
    #[account(
        init,
        seeds = [b"contest".as_ref(), 
        contest_owner.key().as_ref(), 
        counter.contest_count.to_string().as_ref()], // It is added for enabling contest_owner to hold multiple contests
        bump,
        payer = contest_owner, 
        space = 8 + std::mem::size_of::<Contest>() + vec_size as usize //100 is for Vec<u64>, 
    )]
    pub contest: Box<Account<'info, Contest>>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub prize_mint: Account<'info, Mint>,
    #[account(
        init,
        seeds = [b"prize_vault".as_ref(),
        contest_owner.key().as_ref(),
        counter.contest_count.to_string().as_ref()], // It is added for enabling contest_owner to hold multiple contests
        bump,
        payer = contest_owner,
        rent_exempt = enforce,
        token::mint = prize_mint, // no need to use associated_token?
        token::authority = contest_owner,
    )]
    pub prize_vault_account: Account<'info, TokenAccount>,
    #[account(mut, 
        token::mint = prize_mint,
        token::authority = contest_owner)]
    pub prize_token_account: Account<'info, TokenAccount>,
    pub rent: Sysvar<'info, Rent>, //when is "rent" necessary to include?
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[allow(unused)]
pub fn handler(
    ctx: Context<Launch>,
    prize_amount: u64,
    percentage_to_artist: u8,
    submit_start_at: u64,
    submit_end_at: u64,
    vote_start_at: u64,
    vote_end_at: u64,
    title_of_contest: Vec<u8>,
    link_to_project: Vec<u8>,
    vec_size: u8
) -> Result<()> {
        // check time order
        let now_ts  = Clock::get().unwrap().unix_timestamp as u64;
        msg!(&now_ts.to_string());
        assert!(submit_start_at <= submit_end_at);
        assert!(vote_start_at <= vote_end_at);
        assert!(submit_start_at <= vote_start_at);

        // set data in contest account
        ctx.accounts.contest.is_initialized = true;
        
        // write the current contest_count as contest_id. it means that id for the first contest is 0.
        ctx.accounts.contest.contest_id = ctx.accounts.counter.contest_count;
        // increase contest_count by 1
        msg!("contestCount before plus{:?}", ctx.accounts.counter.contest_count);
        ctx.accounts.counter.contest_count += 1;
        msg!("contestCount after plus{:?}", ctx.accounts.counter.contest_count);

        ctx.accounts.contest.contest_owner = ctx.accounts.contest_owner.key();

        assert!(percentage_to_artist <= 100);
        ctx.accounts.contest.prize_amount = prize_amount;
        ctx.accounts.contest.percentage_to_artist = percentage_to_artist;

        ctx.accounts.contest.submit_start_at = submit_start_at;
        ctx.accounts.contest.submit_end_at = submit_end_at;
        ctx.accounts.contest.vote_start_at = vote_start_at;
        ctx.accounts.contest.vote_end_at = vote_end_at;
        ctx.accounts.contest.title_of_contest = title_of_contest;

        ctx.accounts.contest.artwork_count = 0;

        // check if cotest owner has enough tokens for prize
        assert!(ctx.accounts.prize_token_account.amount >= prize_amount);
        
        // assing the authority of prive vault account to prize vault authority
        let (prize_vault_authority, _prize_vault_authority_bump) =
            Pubkey::find_program_address(&[b"prize_vault_authority",
                ctx.accounts.contest.key().as_ref(),
                ],
                ctx.program_id);
        token::set_authority(
            ctx.accounts.into_set_authority_context(),
            AuthorityType::AccountOwner,
            Some(prize_vault_authority),
        )?;

        // transfer tokens to prize vault acount
        token::transfer(ctx.accounts.into_transfer_to_pda_context(), prize_amount)?;
        
        Ok(()) 
}

impl<'info> Launch<'info> {
    fn into_transfer_to_pda_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.prize_token_account.to_account_info().clone(),
            to: self.prize_vault_account.to_account_info().clone(),
            authority: self.contest_owner.to_account_infos()[0].clone(),
        };
        CpiContext::new(
            self.token_program.to_account_infos()[0].clone(),
            cpi_accounts,
        )
    }

    fn into_set_authority_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            account_or_mint: self.prize_vault_account.to_account_info().clone(),
            current_authority: self.contest_owner.to_account_infos()[0].clone(),
        };
        CpiContext::new(
            self.token_program.to_account_infos()[0].clone(),
            cpi_accounts,
        )
    }
}