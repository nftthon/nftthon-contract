import { assert } from 'chai';

import * as anchor from '@project-serum/anchor';
import { BN } from '@project-serum/anchor';
import {
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from '@solana/web3.js';

export const sleep = async (waitTime: number) =>
  new Promise(resolve =>
    setTimeout(resolve, waitTime));

describe("nft_contest", () => {
  // set provicder and program
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  
  const program = anchor.workspace.NftContest;
  console.log(program.programId.toBase58())

  // Relevant Keys
  const payer = anchor.web3.Keypair.generate();
  const mintAuthority = anchor.web3.Keypair.generate();

  const contestOwner = anchor.web3.Keypair.generate();
  const artist1 = anchor.web3.Keypair.generate();
  const artist2 = anchor.web3.Keypair.generate();
  const voter1 = anchor.web3.Keypair.generate();
  const voter2 = anchor.web3.Keypair.generate();
  const voter3 = anchor.web3.Keypair.generate();

  // Relevant token accounts
  let prizeTokenMint = null;
  let nftMint = null;
  let nftMint2 = null;
  let contestOwnerPrizeTokenAccount = null;
  let contestOwnerNftTokenAccount = null;
  let artist1NftAccount = null;
  let artist1PrizeTokenAccount = null;
  let artist2NftAccount = null;
  let artist2PrizeTokenAccount = null;
  let voter1TokenAccount = null;
  let voter2TokenAccount = null;

  // Relevant PDAs
  let counterPda = null;
  let _counterBump = null;
  let contestPda = null;
  let _contestBump = null;
  let prizeVaultPda = null;
  let _prizeVaultBump = null;
  let prizeVaultAuthorityPda = null;
  let _prizeVaultAuthorityBump = null;
  let artworkPda = null;
  let _artworkBump = null;
  let nftVaultPda = null;
  let _nftVaultBump = null;
  let nftVaultAuthorityPda = null;
  let _nftVaultAuthorityBump = null;
  let voteDataPda = null;
  let _voteDataBump = null;

  // Constants
  const prizeAmount = new BN(500*10**9);
  const percentageToArtist = 70 as number;
  const submitStartAt = new BN(Date.now() - 1000000) ;
  const submitEndAt = new BN(Date.now() - 1000000 + 3000); // 3 seconds after from the submitStartAt
  const voteStartAt = new BN(Date.now() - 1000000);
  const voteEndAt = new BN(Date.now() - 1000000 + 3000); // 3 seconds after from the submitStartAt
  const titleOfContest = Buffer.from(anchor.utils.bytes.utf8.encode("Demo Contest"));
  const linkToProject = Buffer.from(anchor.utils.bytes.utf8.encode("www"));
  const vecSize = 200;
  let voted_artwork_id = 0;

  // Unit test
  it("Initialize", async() =>  {
    // Generate a new wallet keypair and airdrop SOL
    const payerAirdropSignature = await connection.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL);
    const latestBlockHash = await connection.getLatestBlockhash();

    // Wait for airdrop confirmation
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: payerAirdropSignature,
    });

    [counterPda, _counterBump] = PublicKey.findProgramAddressSync([Buffer.from(anchor.utils.bytes.utf8.encode("counter"))
      ], program.programId);
      console.log("counter pda: ", counterPda.toBase58());
    
    try {
      const ix = await program.methods.initialize()
      .accounts({
        programOwner: payer.publicKey,
        counter: counterPda,
        systemProgram: SystemProgram.programId})
      .signers([payer])
      .rpc();
      
      console.log("Initialize transaction signature:", ix);

      const counterAccount = await program.account.counter.fetch(counterPda);
      console.log('is initilized: ', counterAccount.isInitialized);
      assert.ok(counterAccount.isInitialized == true);
      console.log('contest count: ', counterAccount.contestCount.toNumber());
      assert.ok(counterAccount.contestCount.toNumber() == 0);
      } catch (error) {
        console.log(error)
    }
  }
  )

  it("Launch", async () => {
    // Generate a new wallet keypair and airdrop SOL
    const payerAirdropSignature = await connection.requestAirdrop(contestOwner.publicKey, LAMPORTS_PER_SOL);
    const latestBlockHash = await connection.getLatestBlockhash();

    // Wait for airdrop confirmation
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: payerAirdropSignature,
    });

    prizeTokenMint = await createMint(
      provider.connection,
      payer,
      mintAuthority.publicKey,
      null,
      9,
    );

    try {
      const counterAccount = await program.account.counter.fetch(counterPda);
      const contestCount = counterAccount.contestCount;
      console.log(contestCount.toNumber());
       [contestPda, _contestBump] = await PublicKey.findProgramAddress(
        [Buffer.from("contest"), 
        contestOwner.publicKey.toBuffer(),
        Buffer.from(anchor.utils.bytes.utf8.encode((contestCount.toNumber()).toString()))
      ], program.programId);
        [prizeVaultPda, _prizeVaultBump] = await PublicKey.findProgramAddressSync(
          [Buffer.from(anchor.utils.bytes.utf8.encode("prize_vault")),  
          contestOwner.publicKey.toBuffer(),
          Buffer.from(anchor.utils.bytes.utf8.encode((contestCount.toNumber()).toString()))
        ], program.programId);
      console.log("prize vault pda: ", prizeVaultPda.toBase58());
      contestOwnerPrizeTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        contestOwner,
        prizeTokenMint,
        contestOwner.publicKey
        );

      await mintTo(
        connection,
        contestOwner,
        prizeTokenMint,
        contestOwnerPrizeTokenAccount.address,
        mintAuthority.publicKey,
        prizeAmount.toNumber(),
        [mintAuthority]
      );

      let _contestOwnerPrizeTokenAccount = await getAccount(connection,
        contestOwnerPrizeTokenAccount.address);
      console.log("intial contest owner prize token account's amount", _contestOwnerPrizeTokenAccount.amount.toString())
      assert.ok(_contestOwnerPrizeTokenAccount.amount == BigInt(prizeAmount.toNumber()))

      const ix = await program.methods.launch(
        prizeAmount,
        percentageToArtist,
        submitStartAt,
        submitEndAt,
        voteStartAt,
        voteEndAt,
        titleOfContest,
        linkToProject,
        vecSize,
        )
      .accounts(
        {
        // tips: Variable names in sneak in rust shall be changed to camel in test typescript
        contestOwner: contestOwner.publicKey,
        counter: counterPda,
        contest: contestPda,
        prizeMint: prizeTokenMint,
        prizeVaultAccount: prizeVaultPda,
        prizeTokenAccount: contestOwnerPrizeTokenAccount.address,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([contestOwner])
      .rpc();

      // assertion
      const _counterAccount = await program.account.counter.fetch(counterPda);
      console.log('is initilized: ', _counterAccount.isInitialized);
      assert.ok(_counterAccount.isInitialized == true);
      console.log('contest count: ', _counterAccount.contestCount.toNumber());

      const contestAccount = await program.account.contest.fetch(contestPda);
      console.log('is initilized: ', contestAccount.isInitialized);
      assert.ok(contestAccount.isInitialized == true);

      console.log('contest id: ', contestAccount.contestId.toNumber());
      assert.ok(contestAccount.contestId.toNumber() == 0);

      console.log('owner: ', contestAccount.contestOwner.toBase58());
      assert.ok(contestAccount.contestOwner.toBase58() == contestOwner.publicKey.toBase58());

      console.log('prize amount: ', contestAccount.prizeAmount.toNumber());
      assert.ok(contestAccount.prizeAmount.toNumber() == prizeAmount.toNumber());

      console.log('percentage to artist: ', contestAccount.percentageToArtist);
      assert.ok(contestAccount.percentageToArtist == percentageToArtist);

      console.log('submit start at: ', contestAccount.submitStartAt.toNumber());
      assert.ok(contestAccount.submitStartAt.toNumber() == submitStartAt.toNumber());

      console.log('title of contest: ', contestAccount.titleOfContest.toString());
      
      let __campaignOwnerPrizeTokenAccount = await getAccount(connection, contestOwnerPrizeTokenAccount.address);
      console.log("after-launch contest owner prize token account's amount", __campaignOwnerPrizeTokenAccount.amount.toString())
      assert.ok(__campaignOwnerPrizeTokenAccount.amount == BigInt(0))

      let _prizeVaultAccount = await getAccount(connection, prizeVaultPda);
      console.log("prize vault token account's amount", _prizeVaultAccount.amount.toString());
      assert.ok(_prizeVaultAccount.amount == BigInt(prizeAmount.toNumber()));

      [prizeVaultAuthorityPda, _prizeVaultAuthorityBump] = await PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("prize_vault_authority")),
        contestPda.toBuffer(),
      ], program.programId);
      assert.ok(_prizeVaultAccount.owner.toBase58() == prizeVaultAuthorityPda.toBase58());
      
    } catch (error) {
      console.log(error)
    }
}
  )
 
  it("Submit", async () => {
    // Generate a new wallet keypair and airdrop SOL
    const artist1AirdropSignature = await connection.requestAirdrop(artist1.publicKey, LAMPORTS_PER_SOL);
    const artist2AirdropSignature = await connection.requestAirdrop(artist2.publicKey, LAMPORTS_PER_SOL);
    const latestBlockHash = await connection.getLatestBlockhash();

    // Wait for airdrop confirmation
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: artist1AirdropSignature,
    });
    
    // for artist2
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: artist2AirdropSignature,
    });

      nftMint = await createMint(
        provider.connection,
        artist1,
        artist1.publicKey,
        null,
        0,
      );
      
      // for artist2
      nftMint2 = await createMint(
        provider.connection,
        artist2,
        artist2.publicKey,
        null,
        0,
      );

    try {
      [artworkPda, _artworkBump] = PublicKey.findProgramAddressSync(
        [Buffer.from(anchor.utils.bytes.utf8.encode("artwork")),  
        contestPda.toBuffer(), 
        artist1.publicKey.toBuffer()
      ], program.programId);
      [nftVaultPda, _nftVaultBump] = PublicKey.findProgramAddressSync(
        [Buffer.from(anchor.utils.bytes.utf8.encode("nft_vault")),
        contestPda.toBuffer(),
        artist1.publicKey.toBuffer()
        ], program.programId);
      console.log("nft vault pda: ", nftVaultPda.toBase58());
      artist1NftAccount = await getOrCreateAssociatedTokenAccount(
        connection, 
        artist1,
        nftMint,
        artist1.publicKey,
        );
      artist1PrizeTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        artist1,
        prizeTokenMint,
        artist1.publicKey
        );

      await mintTo(
        connection,
        artist1,
        nftMint,
        artist1NftAccount.address,
        artist1.publicKey,
        1,
        [artist1],
      );

      let _artist1NftAccount = await getAccount(connection, artist1NftAccount.address);
      console.log("intial artist1 nft account's amount", _artist1NftAccount.amount.toString())
      assert.ok(_artist1NftAccount.amount == BigInt(1));

      const ix = await program.methods.submit()
      .accounts(
        {
        // tips: Variable names in sneak in rust shall be changed to camel in test typescript
        artist: artist1.publicKey,
        contest: contestPda,
        artwork: artworkPda,
        nftMint: nftMint,
        nftVaultAccount: nftVaultPda,
        artworkTokenAccount: artist1NftAccount.address,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([artist1])
      .rpc();

      // assertion
      const artworkAccount = await program.account.artwork.fetch(artworkPda);
      console.log('is initilized: ', artworkAccount.isInitialized);
      assert.ok(artworkAccount.isInitialized == true);

      console.log('artwork id: ', artworkAccount.artworkId.toNumber());
      assert.ok(artworkAccount.artworkId.toNumber() == 0);

      console.log('associated contest id: ', artworkAccount.associatedContestId.toNumber());
      assert.ok(artworkAccount.associatedContestId.toNumber() == 0);

      console.log('artist key: ', artworkAccount.artistKey.toBase58());
      assert.ok(artworkAccount.artistKey.toBase58() == artist1.publicKey.toBase58());

      let __artist1NftAccount = await getAccount(connection, artist1NftAccount.address);
      console.log("after-submit contest owner prize token account's amount", __artist1NftAccount.amount.toString())
      assert.ok(__artist1NftAccount.amount == BigInt(0))

      let _nftVaultAccount = await getAccount(connection, nftVaultPda);
      console.log("nft vault token account's amount", _nftVaultAccount.amount.toString())
      assert.ok(_nftVaultAccount.amount == BigInt(1));

      [nftVaultAuthorityPda, _nftVaultAuthorityBump] = PublicKey.findProgramAddressSync(
        [Buffer.from(anchor.utils.bytes.utf8.encode("nft_vault_authority")),
        contestPda.toBuffer(),
        artist1.publicKey.toBuffer()
      ], program.programId);
      assert.ok(_nftVaultAccount.owner.toBase58() == nftVaultAuthorityPda.toBase58());
      
      // for artist2
      const [artworkPda2, _artworkVaultBump2] = PublicKey.findProgramAddressSync(
        [Buffer.from(anchor.utils.bytes.utf8.encode("artwork")),  
        contestPda.toBuffer(),
        artist2.publicKey.toBuffer(),
      ], program.programId);
      const [nftVaultPda2, _nftVaultBump2] = PublicKey.findProgramAddressSync(
        [Buffer.from(anchor.utils.bytes.utf8.encode("nft_vault")),
        contestPda.toBuffer(),  
        artist2.publicKey.toBuffer()
      ], program.programId);
      console.log("nft vault pda: ", nftVaultPda2.toBase58());
    
      artist2NftAccount = await getOrCreateAssociatedTokenAccount(
        connection, 
        artist2,
        nftMint2,
        artist2.publicKey,);
      artist2PrizeTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        artist2,
        prizeTokenMint,
        artist2.publicKey
        );

        await mintTo(
          connection,
          artist2,
          nftMint2,
          artist2NftAccount.address,
          artist2.publicKey,
          1,
          [artist2],
        );

      let _artist2NftAccount = await getAccount(connection, artist2NftAccount.address);
      console.log("intial artist2 nft account's amount", _artist2NftAccount.amount.toString())
      assert.ok(_artist2NftAccount.amount == BigInt(1));
      
      const ix2 = await program.methods.submit()
      .accounts(
        {
        artist: artist2.publicKey,
        contest: contestPda,
        artwork: artworkPda2,
        nftMint: nftMint2,
        nftVaultAccount: nftVaultPda2,
        artworkTokenAccount: artist2NftAccount.address,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([artist2])
      .rpc();
    } catch (error) {
      console.log(error)
    }
  }
  )  

  it("Vote", async () => {
    const voter1AirdropSignature = await connection.requestAirdrop(voter1.publicKey, LAMPORTS_PER_SOL);
    const voter2AirdropSignature = await connection.requestAirdrop(voter2.publicKey, LAMPORTS_PER_SOL);
    const latestBlockHash = await connection.getLatestBlockhash();

    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: voter1AirdropSignature,
    });

    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: voter2AirdropSignature,
    });
    
    try {
      [voteDataPda, _voteDataBump] = PublicKey.findProgramAddressSync(
        [Buffer.from(anchor.utils.bytes.utf8.encode("vote")),
        contestPda.toBuffer(), 
        voter1.publicKey.toBuffer()
      ], program.programId);

      voter1TokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        voter1,
        prizeTokenMint,
        voter1.publicKey
        );
      
      const ix = await program.methods.vote(voted_artwork_id)
      .accounts(
        {
        voter: voter1.publicKey,
        artwork: artworkPda,
        contest: contestPda,
        voteData: voteDataPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter1])
      .rpc();

      // assertion
      const voteDataAccount = await program.account.voteData.fetch(voteDataPda);
      console.log('is initilized: ', voteDataAccount.isInitialized);
      assert.ok(voteDataAccount.isInitialized == true);

      console.log('voted artwork id: ', voteDataAccount.votedArtworkId.toNumber());
      assert.ok(voteDataAccount.votedArtworkId.toNumber() == 0);

      // for voter2
      const [voteDataPda2, _voteDataBump2] = PublicKey.findProgramAddressSync(
        [Buffer.from(anchor.utils.bytes.utf8.encode("vote")),
        contestPda.toBuffer(), 
        voter2.publicKey.toBuffer()
      ], program.programId);

      voter2TokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        voter2,
        prizeTokenMint,
        voter2.publicKey
        );
      
      const ix2 = await program.methods.vote(voted_artwork_id)
      .accounts(
        {
        voter: voter2.publicKey,
        artwork: artworkPda,
        contest: contestPda,
        voteData: voteDataPda2,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter2])
      .rpc();

      // assertion
      const contestAccount = await program.account.contest.fetch(contestPda);
      console.log('artwork vote counter | artwork1:', 
          contestAccount.artworksVoteCounter[0].toNumber(),
          'artwork2:', 
          contestAccount.artworksVoteCounter[1].toNumber());
    
    } catch (error) {
      console.log(error)
    }
  })

  it("ClaimByArtist", async () => {
    try {
      const ix = await program.methods.claimByArtist()
      .accounts(
        {
        // tips: Variable names in sneak in rust shall be changed to camel in test typescript
        artist: artist1.publicKey,
        artwork: artworkPda,
        contest: contestPda,
        prizeMint: prizeTokenMint,
        prizeVaultAccount: prizeVaultPda,
        prizeVaultAuthority: prizeVaultAuthorityPda,
        artistTokenAccount: artist1PrizeTokenAccount.address,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([artist1])
      .rpc();

      let _prizeVaultAccount = await getAccount(connection, prizeVaultPda);
      console.log("prize vault token account's amount", _prizeVaultAccount.amount.toString())
      // assert.ok(_prizeVaultAccount.amount.toString() == (BigInt(prizeAmount.toNumber()) * (100 - percentageToArtist) / 100).toString());

      let _artistTokenAccount = await getAccount(connection, artist1PrizeTokenAccount.address);
      console.log("artist token account's amount", _artistTokenAccount.amount.toString())
      // assert.ok(_artistTokenAccount.amount.toNumber() == prizeAmount.toNumber() * percentageToArtist / 100);
    
      // for vote2 which will fail
    //   const [artworkPda2, _artworkVaultBump2] = await PublicKey.findProgramAddress(
    //     [Buffer.from(anchor.utils.bytes.utf8.encode("artwork")),  
    //     campaignPda.toBuffer(), artist2.publicKey.toBuffer()], program.programId);
    //   console.log("artwork pda: ", artworkPda.toBase58());
      
    //   const ix2 = await program.methods.claimByArtist()
    //   .accounts(
    //     {
    //     // tips: Variable names in sneak in rust shall be changed to camel in test typescript
    //     artist: artist2.publicKey,
    //     artwork: artworkPda2,
    //     contest: campaignPda,
    //     mint: prizeTokenMint.publicKey,
    //     prizeVaultAccount: prizeVaultPda,
    //     prizeVaultAuthority: prizeVaultAuthorityPda,
    //     artistTokenAccount: artist2PrizeTokenAccount,
    //     rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    //     tokenProgram: TOKEN_PROGRAM_ID,
    //     systemProgram: SystemProgram.programId,
    //   })
    //   .signers([artist2])
    //   .rpc();

    //   let __prizeVaultAccount = await prizeTokenMint.getAccountInfo(prizeVaultPda);
    //   console.log("prize vault token account's amount", __prizeVaultAccount.amount.toNumber())
    //   assert.ok(__prizeVaultAccount.amount.toNumber() == prizeAmount.toNumber() * (100 - percentageToArtist.toNumber()) / 100);

    //   let _artistTokenAccount2 = await prizeTokenMint.getAccountInfo(artist2PrizeTokenAccount);
    //   console.log("artist token account's amount", _artistTokenAccount2.amount.toNumber())
    //   assert.ok(_artistTokenAccount2.amount.toNumber() == prizeAmount.toNumber() * (percentageToArtist.toNumber()) / 100);
    } catch (error) {
      console.log(error)
    }
  }
  )

  it("ClaimByVoter", async () => {
    try {
      const ix = await program.methods.claimByVoter()
      .accounts(
        {
        // tips: Variable names in sneak in rust shall be changed to camel in test typescript
        voter: voter1.publicKey,
        artwork: artworkPda,
        contest: contestPda,
        prizeMint: prizeTokenMint,
        voteData: voteDataPda,
        prizeVaultAccount: prizeVaultPda,
        prizeVaultAuthority: prizeVaultAuthorityPda,
        voterTokenAccount: voter1TokenAccount.address,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter1])
      .rpc();

      const contestAccount = await program.account.contest.fetch(contestPda);
      const winnerNumVote = contestAccount.artworksVoteCounter[0].toNumber();

      let _prizeVaultAccount = await getAccount(connection, prizeVaultPda);
      console.log("prize vault token account's amount", _prizeVaultAccount.amount.toString())

      let _voterTokenAccount = await getAccount(connection, voter1TokenAccount.address);
      console.log("voter token account's amount", _voterTokenAccount.amount.toString())
      // assert.ok(_voterTokenAccount.amount == prizeAmount.toNumber() * (100 - percentageToArtist) / winnerNumVote / 100);
    } catch (error) {
      console.log(error)
    }
  }
  )

  it("Claim an NFT by contest owner", async () => {
    try {
      contestOwnerNftTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        contestOwner,
        nftMint,
        contestOwner.publicKey
        );

      const ix = await program.methods.claimByContestOwner()
      .accounts(
        {
        contestOwner: contestOwner.publicKey,
        contest: contestPda,
        artwork: artworkPda,
        nftMint: nftMint,
        nftVaultAccount: nftVaultPda,
        nftVaultAuthority: nftVaultAuthorityPda,
        contestOwnerNftTokenAccount: contestOwnerNftTokenAccount.address,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([contestOwner])
      .rpc();

    
      // assertion
      let _nftVaultAccount = await getAccount(connection, nftVaultPda);
      console.log("nft vault token account's amount", _nftVaultAccount.amount.toString())
      assert.ok(_nftVaultAccount.amount == BigInt(0));

      let _contestOwnerNftTokenAccount = await getAccount(connection, contestOwnerNftTokenAccount.address);
      console.log("contest owner's nft token account's amount", _contestOwnerNftTokenAccount.amount.toString())
      assert.ok(_contestOwnerNftTokenAccount.amount == BigInt(1));
    } catch (error) {
      console.log(error)
    }
  }
  )
})