use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, SetAuthority, Token, TokenAccount, Transfer};
use spl_token::instruction::AuthorityType;

#[derive(Accounts)]
pub struct Submit<'info> {
    #[account(mut)]
    pub artist: Signer<'info>,
    #[account(mut,
        owner = *program_id)]
    pub contest: Account<'info, Contest>,
    #[account(
        init,
        seeds = [b"artwork".as_ref(),
            contest.key().as_ref(),
            artist.key().as_ref(),
            ], // an artist i.e. wallet can submit only one artwork per contest
        bump,
        payer = artist,
        space = 8 + std::mem::size_of::<Artwork>(),
    )]
    pub artwork: Box<Account<'info, Artwork>>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mint::decimals = 0)]
    pub nft_mint: Account<'info, Mint>,
    #[account(
        init,
        seeds = [b"nft_vault".as_ref(), 
            contest.key().as_ref(),
            artist.key().as_ref()],
        bump,
        payer = artist,
        token::mint = nft_mint,
        token::authority = artist,
    )]
    pub nft_vault_account: Account<'info, TokenAccount>,
    #[account(mut,
        token::mint = nft_mint,
        token::authority = artist,
        constraint = artwork_token_account.amount == 1)]
    pub artwork_token_account: Account<'info, TokenAccount>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Submit>) -> Result<()> {
    // check time order
    let contest = &mut ctx.accounts.contest;
    // let submit_start_at = contest.submit_start_at;
    let submit_end_at = contest.submit_end_at;
    let now_ts = Clock::get().unwrap().unix_timestamp as u64;
    assert!(now_ts <= submit_end_at);

    // set data in artwork account
    ctx.accounts.artwork.is_initialized = true;

    // set artwork id in Artwork account = artwork count in Contest account. Id for The first artwork for any contest is 0.
    ctx.accounts.artwork.artwork_id = contest.artwork_count;
    // increase arwork_count by 1
    contest.artwork_count += 1;
    ctx.accounts.artwork.associated_contest_id = contest.contest_id;
    ctx.accounts.artwork.artist_key = ctx.accounts.artist.key();

    // write pubkey of NFT token account in artwork account
    ctx.accounts.artwork.artwork_token_account = ctx.accounts.artwork_token_account.key();

    // put 0 as num of positive votes in contest account
    contest.artworks_vote_counter.push(0);

    let (nft_vault_authority, _nft_vault_authority_bump) = Pubkey::find_program_address(
        &[
            b"nft_vault_authority",
            ctx.accounts.contest.key().as_ref(),
            ctx.accounts.artist.key().as_ref(),
        ],
        ctx.program_id,
    );
    token::set_authority(
        ctx.accounts.into_set_authority_context(),
        AuthorityType::AccountOwner,
        Some(nft_vault_authority),
    )?;

    // transfer NFT to vault account
    token::transfer(ctx.accounts.into_transfer_to_pda_context(), 1)?;

    Ok(())
}

impl<'info> Submit<'info> {
    fn into_transfer_to_pda_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.artwork_token_account.to_account_info().clone(),
            to: self.nft_vault_account.to_account_info().clone(),
            authority: self.artist.to_account_infos()[0].clone(),
        };
        CpiContext::new(
            self.token_program.to_account_infos()[0].clone(),
            cpi_accounts,
        )
    }

    fn into_set_authority_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            account_or_mint: self.nft_vault_account.to_account_info().clone(),
            current_authority: self.artist.to_account_infos()[0].clone(),
        };
        CpiContext::new(
            self.token_program.to_account_infos()[0].clone(),
            cpi_accounts,
        )
    }
}
