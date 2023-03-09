use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
pub struct ClaimByContestOwner<'info> {
    #[account(mut)]
    pub contest_owner: Signer<'info>,
    #[account(mut,
    owner = *program_id)]
    pub contest: Account<'info, Contest>,
    #[account(mut,
      owner = *program_id)]
    pub artwork: Account<'info, Artwork>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub nft_mint: Account<'info, Mint>,
    #[account(mut,
    token::mint = nft_mint,
    token::authority = nft_vault_authority)]
    pub nft_vault_account: Account<'info, TokenAccount>,
    /// CHECK: only used as a signing PDA
    pub nft_vault_authority: UncheckedAccount<'info>,
    #[account(mut,
    token::mint = nft_mint,
    token::authority = contest_owner)]
    pub contest_owner_nft_token_account: Account<'info, TokenAccount>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimByContestOwner>) -> Result<()> {
    let contest = &ctx.accounts.contest;
    let artwork = &ctx.accounts.artwork;

    // check if Signer is the owner of the contest which the claimed NFT is submitted to
    assert!(artwork.associated_contest_id == ctx.accounts.contest.contest_id); // artwork corresponds to contest

    // contest_owner = signer is assured by the security of accounts. NFT is relevant to the contest owned by the signer is assured by the part of creating authority seeds of nft_token_vault
    // send NFT to the token account owned by contest owner
    let artist_key = ctx.accounts.artwork.artist_key;
    let contest_key = contest.key();

    // transfer tokens to vault account
    let (_nft_vault_authority, nft_vault_authority_bump) = Pubkey::find_program_address(
        &[
            b"nft_vault_authority",
            contest_key.as_ref(),
            artist_key.as_ref(),
        ],
        ctx.program_id,
    );

    let authority_seeds = &[
        b"nft_vault_authority".as_ref(),
        contest_key.as_ref(),
        artist_key.as_ref(),
        &[nft_vault_authority_bump],
    ];

    let claimed_amount = 1 as u64;
    token::transfer(
        ctx.accounts
            .into_transfer_to_pda_context()
            .with_signer(&[&authority_seeds[..]]),
        claimed_amount,
    )?;
    Ok(())
}

impl<'info> ClaimByContestOwner<'info> {
    fn into_transfer_to_pda_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.nft_vault_account.to_account_info().clone(),
            to: self
                .contest_owner_nft_token_account
                .to_account_info()
                .clone(),
            authority: self.nft_vault_authority.to_account_info().clone(),
        };
        CpiContext::new(
            self.token_program.to_account_infos()[0].clone(),
            cpi_accounts,
        )
    }
}
