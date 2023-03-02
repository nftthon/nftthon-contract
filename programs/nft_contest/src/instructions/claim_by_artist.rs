use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use solana_safe_math::SafeMath;

#[derive(Accounts)]
pub struct ClaimByArtist<'info> {
    #[account(mut)]
    pub artist: Signer<'info>,
    #[account(mut,
        owner = *program_id)]
    pub artwork: Account<'info, Artwork>,
    #[account(mut,
        owner = *program_id)]
    pub contest: Account<'info, Contest>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub prize_mint: Account<'info, Mint>,
    #[account(mut,
        token::mint = prize_mint,
        token::authority = prize_vault_authority)]
    pub prize_vault_account: Account<'info, TokenAccount>,
    #[account(mut)]
    /// CHECK: only used as a signing PDA
    pub prize_vault_authority: UncheckedAccount<'info>,
    #[account(mut,
        token::mint = prize_mint,
        token::authority = artist)]
    pub artist_token_account: Account<'info, TokenAccount>,
    pub rent: Sysvar<'info, Rent>, //when is this required to include?
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimByArtist>) -> Result<()> {
    // check time order
    let contest = &ctx.accounts.contest;
    // let vote_end_at = contest.vote_end_at;
    // let now_ts = Clock::get().unwrap().unix_timestamp as u64;
    // assert!(vote_end_at < now_ts); // to study: is this safe? safe way to compare?

    // check if signer is an artist of artwork specified in accounts
    assert!(ctx.accounts.artwork.artist_key == ctx.accounts.artist.key());

    // fetch the order and num of votes for the most voted artwork_vote_counter in contest account
    let artworks = &contest.artworks_vote_counter;
    let mut winner_artwork_num_of_votes = 0 as u64;
    let mut winner_artwork_id = 0;
    for i in 0..artworks.len() as usize {
        if artworks[i] > winner_artwork_num_of_votes {
            winner_artwork_num_of_votes = artworks[i];
            winner_artwork_id = i as u64;
        }
    }

    let artwork_id = ctx.accounts.artwork.artwork_id;

    // check if the specified artwork account is the most voted artwork's account through evaluating artwork id
    assert!(artwork_id == winner_artwork_id);

    // transfer tokens to vault account
    let (_prize_vault_authority, prize_vault_authority_bump) = Pubkey::find_program_address(
        &[
            b"prize_vault_authority",
            ctx.accounts.contest.key().as_ref(),
        ],
        ctx.program_id,
    );
    let contest_key = contest.key();
    let authority_seeds = &[
        b"prize_vault_authority".as_ref(),
        contest_key.as_ref(),
        &[prize_vault_authority_bump],
    ];
    let prize_amount = ctx.accounts.contest.prize_amount;
    let percentage_to_artist = ctx.accounts.contest.percentage_to_artist;
    let claimed_amount = (prize_amount * percentage_to_artist as u64).safe_div(100)?;
    token::transfer(
        ctx.accounts
            .into_transfer_to_pda_context()
            .with_signer(&[&authority_seeds[..]]),
        claimed_amount,
    )?;

    Ok(())
}

impl<'info> ClaimByArtist<'info> {
    fn into_transfer_to_pda_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.prize_vault_account.to_account_info().clone(),
            to: self.artist_token_account.to_account_info().clone(),
            authority: self.prize_vault_authority.to_account_info().clone(),
        };
        CpiContext::new(
            self.token_program.to_account_infos()[0].clone(),
            cpi_accounts,
        )
    }
}
