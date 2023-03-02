use anchor_lang::prelude::*;

#[repr(C)]
#[account]
pub struct Counter {
    pub is_initialized: bool,
    pub contest_count: u64,
}

#[repr(C)]
#[account]
pub struct Contest {
    pub is_initialized: bool,
    pub contest_id: u64,
    pub contest_owner: Pubkey,
    pub prize_amount: u64,
    pub percentage_to_artist: u8,
    pub submit_start_at: u64,
    pub submit_end_at: u64,
    pub vote_start_at: u64,
    pub vote_end_at: u64,
    pub title_of_contest: Vec<u8>,
    pub link_to_project: Vec<u8>,
    pub artwork_count: u64,
    pub artworks_vote_counter: Vec<u64>,
}

#[repr(C)]
#[account]
pub struct Artwork {
    pub is_initialized: bool,
    pub artwork_id: u64,
    pub associated_contest_id: u64,
    pub artist_key: Pubkey,
    pub artwork_token_account: Pubkey,
}

#[repr(C)]
#[account]
pub struct VoteData {
    pub is_initialized: bool,
    pub voter_key: Pubkey,
    pub voted_artwork_id: u64,
}
