use anchor_lang::prelude::*;
use instructions::*;

pub mod common;
pub mod instructions;
pub mod state;

declare_id!("8wRhhgnw55z1QELi6wDoAnKbnYsU9X9U5kZnMQ12vopf");

#[program]
pub mod nft_contest {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }

    pub fn launch(
        ctx: Context<Launch>,
        prize_amount: u64,
        percentage_to_artist: u8, // amount is raw number like lamports
        submit_start_at: u64,
        submit_end_at: u64,
        vote_start_at: u64,
        vote_end_at: u64,
        title_of_contest: Vec<u8>,
        link_to_project: Vec<u8>,
        vec_size: u8,
    ) -> Result<()> {
        instructions::launch::handler(
            ctx,
            prize_amount,
            percentage_to_artist, // amount is raw number like lamports
            submit_start_at,
            submit_end_at,
            vote_start_at,
            vote_end_at,
            title_of_contest,
            link_to_project,
            vec_size,
        )
    }

    // function to cancel existing contest and withdrawal prize is not implemeted yet.
    pub fn submit(ctx: Context<Submit>) -> Result<()> {
        instructions::submit::handler(ctx)
    }

    pub fn vote(ctx: Context<Vote>, voted_artwork_id: u8) -> Result<()> {
        instructions::vote::handler(ctx, voted_artwork_id as usize)
    }

    pub fn claim_by_artist(ctx: Context<ClaimByArtist>) -> Result<()> {
        instructions::claim_by_artist::handler(ctx)
    }

    pub fn claim_by_voter(ctx: Context<ClaimByVoter>) -> Result<()> {
        instructions::claim_by_voter::handler(ctx)
    }
}
