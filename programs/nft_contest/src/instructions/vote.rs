use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Vote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,
    #[account(mut,
    )]
    pub artwork: Account<'info, Artwork>,
    #[account(mut,
        )]
    pub contest: Account<'info, Contest>,
    #[account(
        init,
        seeds = [b"vote".as_ref(), // One can vote only one time per contest.
            contest.key().to_bytes().as_ref(), 
            voter.key.to_bytes().as_ref()],
        bump,
        payer = voter,
        space = 8 + std::mem::size_of::<VoteData>(),
    )]
    pub vote_data: Account<'info, VoteData>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Vote>, voted_artwork_id: usize) -> Result<()> {
    // check time order
    let contest = &mut ctx.accounts.contest;
    // let vote_start_at = contest.vote_start_at;
    // let vote_end_at = contest.vote_end_at;
    // let now_ts = Clock::get().unwrap().unix_timestamp as u64;
    // assert!(vote_start_at <= now_ts);
    // assert!(now_ts <= vote_end_at);

    // check if voted_artwork_id input matches with specified artwork account
    assert!(voted_artwork_id as u64 == ctx.accounts.artwork.artwork_id, "voted_artwork_id is not correct");
    // check if specified artwork account and specified contest account match
    assert!(ctx.accounts.artwork.associated_contest_id == contest.contest_id);

    // set data in VoteData account
    ctx.accounts.vote_data.is_initialized = true;
    ctx.accounts.vote_data.voter_key = ctx.accounts.voter.key();
    ctx.accounts.vote_data.voted_artwork_id = voted_artwork_id as u64;

    // add 1 to the corresponding place of order in artworks vote counter
    contest.artworks_vote_counter[voted_artwork_id] += 1;

    Ok(())
}
