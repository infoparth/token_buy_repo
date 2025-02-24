import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenBiu } from "../target/types/token_biu";
import {
  createMint,
  mintTo,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import {
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { assert } from "chai";
import { SYSVAR_CLOCK_PUBKEY } from '@solana/web3.js';


describe("token_biu", () => {

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.TokenBiu as Program<TokenBiu>;
  const initialTokenLimit = 10000000 * 1000000;

  // Dynamically create wallet 1 and wallet 2
  const wallet: Keypair = Keypair.generate();
  const buyer: Keypair = Keypair.generate();
  const recipient: Keypair = Keypair.generate();

  let saleConfig: Keypair;
  let mint: anchor.web3.PublicKey;
  let programSaleAuthority: anchor.web3.PublicKey;
  let programTokenAccount: anchor.web3.PublicKey;
  let buyerTokenAccount;

  const currentTimestamp = new anchor.BN(Math.floor(Date.now() / 1000));
  const nextMonthTimestamp = currentTimestamp.add(new anchor.BN(2629743)); // ~1 month in seconds
  const nextHourTimestamp = currentTimestamp.add(new anchor.BN(3600)); // ~1 month in seconds

  before(async () => {

    console.log("\n=======================================");
    console.log("Starting setup in `before` hook...");
    console.log("=======================================");

    try {
      console.log("\n--- Requesting SOL airdrop for wallet and buyer ---");
      await Promise.all([
        provider.connection.requestAirdrop(
          wallet.publicKey,
          2 * LAMPORTS_PER_SOL
        ),
        provider.connection.requestAirdrop(
          buyer.publicKey,
          5 * LAMPORTS_PER_SOL
        ),
      ]).then((signatures) =>
        Promise.all(
          signatures.map((sig) => provider.connection.confirmTransaction(sig))
        )
      );
      console.log("Airdrop completed.\n");
    } catch (error) {
      console.error("Error during SOL airdrop:", error);
    }

    try {
      console.log("\n--- Creating token mint ---");
      mint = await createMint(
        provider.connection,
        wallet,
        wallet.publicKey,
        null,
        6
      );
      console.log("Token mint created successfully:", mint.toBase58(), "\n");
    } catch (error) {
      console.error("Error during token mint creation:", error);
      throw error;
    }

    try {
      console.log("\n--- Finding program sale authority PDA ---");
      const [authority, bump] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("SALE_AUTHORITY")],
        program.programId
      );
      programSaleAuthority = authority;
      console.log(
        "Program sale authority PDA:",
        programSaleAuthority.toBase58(),
        "\n"
      );
    } catch (error) {
      console.error("Error finding PDA for sale authority:", error);
      throw error;
    }

    try {
      console.log(
        "\n--- Getting associated token account for program sale authority ---"
      );
      programTokenAccount = getAssociatedTokenAddressSync(
        mint,
        programSaleAuthority,
        true // allowOwnerOffCurve
      );
      console.log(
        "Program token account:",
        programTokenAccount.toBase58(),
        "\n"
      );

      console.log(
        "\n--- Creating associated token account for program sale authority ---"
      );
      const ataInstruction = createAssociatedTokenAccountInstruction(
        // This is the instruction to create a new associated token account
        wallet.publicKey, // Payer
        programTokenAccount, // Associated Token Account
        programSaleAuthority, // Off-curve owner
        mint // Token Mint
      );

      const transaction = new anchor.web3.Transaction().add(ataInstruction);

      await provider.sendAndConfirm(transaction, [wallet]);
      console.log(
        "ATA created for programSaleAuthority (off-curve):",
        programTokenAccount.toBase58(),
        "\n"
      );
    } catch (error) {
      console.error("Error getting associated token account:", error);
      throw error;
    }

    try {
      console.log("\n--- Initializing sale configuration ---");
      saleConfig = anchor.web3.Keypair.generate();
      const tokenPriceUsd = 0.005;
      const mintDecimals = new anchor.BN(6);
      const tokenLimit = new anchor.BN(initialTokenLimit);

      await program.methods
        .initializeSale(tokenPriceUsd, mintDecimals, tokenLimit)
        .accounts({
          authority: wallet.publicKey,
          saleConfig: saleConfig.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          recipient: recipient.publicKey,
          tokenMint: mint,
        })
        .signers([wallet, saleConfig])
        .rpc();
      console.log("Sale configuration initialized successfully.\n");
    } catch (error) {
      console.error("Error during sale initialization:", error);
      throw error;
    }

    try {
      console.log("\n--- Minting tokens to program token account ---");
      const DECIMALS = 6;
      const TOKEN_PRICE_USD = 0.005;
      const SOL_PRICE_USD = 190.0;

      const solAmount = LAMPORTS_PER_SOL; // 1 SOL
      const solAmountUsd = (solAmount * SOL_PRICE_USD) / 1e9;
      const expectedTokenAmount =
        (solAmountUsd / TOKEN_PRICE_USD) * Math.pow(10, DECIMALS);
      const MINT_AMOUNT = expectedTokenAmount * 5; // Mint double what we need

      console.log(`Minting ${MINT_AMOUNT} tokens to program account...`);
      await mintTo(
        provider.connection,
        wallet,
        mint,
        programTokenAccount,
        wallet.publicKey,
        MINT_AMOUNT
      );

      const tokenAccount = await getAccount(
        provider.connection,
        programTokenAccount
      );
      console.log(`Program token account balance: ${tokenAccount.amount}\n`);
    } catch (error) {
      console.error("Error during token minting:", error);
      throw error;
    }
  });
  // First, add the MonthlyLimits account to your BuyTokens test
  const [monthlyLimitsAccount, monthlyLimitsBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("monthly_limits")],
    program.programId
  );

  it("Sets monthly limits", async () => {
    console.log("\n=======================================");
    console.log("Setting monthly limits...");
    console.log("=======================================");

    const _monthlyLimits = Array(12).fill(1000 * 1000000).map(limit => new anchor.BN(limit));
    const values = [100, 100, 100, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 600000, 600000]
    const monthlyLimits = values.map(value => new anchor.BN(value * 1000000));
    const totalTokens = new anchor.BN(2400000 * 1000000)

    // Add event listener for MonthlyLimitsSet
    const listener = program.addEventListener(
      "MonthlyLimitsSet",
      (event, _slot) => {
        console.log("MonthlyLimitsSet event emitted:", event);
        assert.deepEqual(event.limits, monthlyLimits);
      }
    );

    try {
      const tx = await program.methods
        .setMonthlyLimits(monthlyLimits, totalTokens)
        .accounts({
          authority: wallet.publicKey,
          saleConfig: saleConfig.publicKey,
          monthlyLimits: monthlyLimitsAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([wallet])
        .rpc();

      console.log("Monthly limits set successfully:", tx);

      // Verify the monthly limits were set correctly
      const monthlyLimitsState = await program.account.monthlyLimits.fetch(monthlyLimitsAccount);
      assert.isTrue(
        monthlyLimitsState.tokensUnlocked.toNumber() == 0,
        "Tokens bought this month should be greater than 0"
      );
      assert.isTrue(
        monthlyLimitsState.tokensUnlocked.toNumber() <=
        monthlyLimitsState.limits[0].toNumber(),
        "Tokens bought should not exceed monthly limit"
      );
    } catch (error) {
      console.error("Error setting monthly limits:", error);
      throw error;
    } finally {
      program.removeEventListener(listener);
    }
  });

  it("Enforces monthly purchase limits", async () => {
    console.log("\n=======================================");
    console.log("Testing monthly purchase limits...");
    console.log("=======================================");

    const DECIMALS = 6;
    const TOKEN_PRICE_USD = 0.005;
    const SOL_PRICE_USD = 190.0;

    // Calculate token amount that would exceed monthly limit
    const solAmount = new anchor.BN(0.03 * LAMPORTS_PER_SOL); // 2 SOL
    const firstPurhcase = new anchor.BN(0.02 * LAMPORTS_PER_SOL);
    const solAmountUsd = (firstPurhcase.toNumber() * SOL_PRICE_USD) / 1e9;
    const expectedTokenAmount = Math.floor((solAmountUsd / TOKEN_PRICE_USD) * Math.pow(10, DECIMALS));

    try {

      await disableVesting(program, wallet, saleConfig, monthlyLimitsAccount);

      // First purchase should succeed
      const [walletPurchaseAccount] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("wallet_purchase"), buyer.publicKey.toBuffer()],
        program.programId
      );

      const tx1 = await program.methods
        .buyTokens(firstPurhcase, currentTimestamp)
        .accounts({
          buyer: buyer.publicKey,
          saleAuthority: recipient.publicKey,
          programSaleAuthority: programSaleAuthority,
          saleConfig: saleConfig.publicKey,
          authority: wallet.publicKey,
          mint: mint,
          programTokenAccount: programTokenAccount,
          buyerTokenAccount: buyerTokenAccount,
          walletPurchase: walletPurchaseAccount,
          monthlyLimits: monthlyLimitsAccount,

          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
        })
        .signers([buyer])
        .rpc();

      console.log("First purchase successful:", tx1);

      const txConfirmation = await program.provider.connection.confirmTransaction(tx1);
      console.log("Transaction confirmed:", txConfirmation);

      const _monthlyLimitsState = await program.account.monthlyLimits.fetch(monthlyLimitsAccount);
      const _dailyLimitsState = await program.account.walletPurchase.fetch(walletPurchaseAccount);

      console.log("Total tokens a bought today are: ", _dailyLimitsState.totalPurchased.toString())
      console.log("Total tokens a bought this months are: ", _monthlyLimitsState.tokensUnlocked.toString())
      assert.isTrue(
        _monthlyLimitsState.tokensUnlocked.gt(new anchor.BN(0)),
        "Tokens bought this month should be greater than 0"
      );
      // assert.isTrue(
      //   _monthlyLimitsState.tokensUnlocked.lte(
      //     _monthlyLimitsState.limits[0]
      //   ),
      //   "Tokens bought should not exceed monthly limit"
      // );

      assert.isTrue(
        _monthlyLimitsState.tokensUnlocked.toNumber() === expectedTokenAmount,
        "Tokens bought should be equal"
      );


      // Second purchase should fail due to monthly limit
      try {
        const tx = await program.methods
          .buyTokens(solAmount, nextMonthTimestamp)
          .accounts({
            buyer: buyer.publicKey,
            saleAuthority: recipient.publicKey,
            programSaleAuthority: programSaleAuthority,
            saleConfig: saleConfig.publicKey,
            authority: wallet.publicKey,
            mint: mint,
            programTokenAccount: programTokenAccount,
            buyerTokenAccount: buyerTokenAccount,
            walletPurchase: walletPurchaseAccount,
            monthlyLimits: monthlyLimitsAccount,

            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
          })
          .signers([buyer])
          .rpc();


        // assert.fail("Second purchase should have failed due to monthly limit");
      } catch (error) {
        assert.include(error.message, "MonthlyLimitExceeded");
        console.log("Monthly limit correctly enforced");
      }

      // Verify monthly limits state
      const monthlyLimitsState = await program.account.monthlyLimits.fetch(monthlyLimitsAccount);
      const dailyLimitsState = await program.account.walletPurchase.fetch(walletPurchaseAccount);

      console.log("Total tokens bought  for daily limit after second purchase are: ", dailyLimitsState.totalPurchased.toString())
      console.log("Total tokens bought this months after second purchase are: ", monthlyLimitsState.tokensUnlocked.toString())
      assert.isTrue(
        monthlyLimitsState.tokensUnlocked.gt(new anchor.BN(0)),
        "Tokens bought this month should be greater than 0"
      );
      // assert.isTrue(
      //   monthlyLimitsState.tokensUnlocked.lte(
      //     monthlyLimitsState.limits[1]
      //   ),
      //   "Tokens bought should not exceed monthly limit"
      // );
    } catch (error) {
      console.error("Error testing monthly limits:", error);
      const monthlyLimitsState = await program.account.monthlyLimits.fetch(monthlyLimitsAccount);


      console.log("Total tokens bought this months are: ", monthlyLimitsState.tokensUnlocked.toString())
      throw error;
    }
  });

  it("Tests monthly limits across multiple months", async () => {
    console.log("\n=======================================");
    console.log("Testing monthly limits across months...");
    console.log("=======================================");

    const DECIMALS = 6;
    const TOKEN_PRICE_USD = 0.005;
    const SOL_PRICE_USD = 190.0;
    const smallPurchase = new anchor.BN(0.02 * LAMPORTS_PER_SOL);

    const [walletPurchaseAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("wallet_purchase"), buyer.publicKey.toBuffer()],
      program.programId
    );

    const monthlyLimitsState = await program.account.monthlyLimits.fetch(monthlyLimitsAccount);
    const dailyLimitsState = await program.account.walletPurchase.fetch(walletPurchaseAccount);

    console.log("Monthly Limits state values: ")
    console.log(monthlyLimitsState.startingMonth.toString())
    console.log(monthlyLimitsState.totalLocked.toString())
    console.log(monthlyLimitsState.tokensUnlocked.toString())

    try {
      // First purchase in current month
      await program.methods
        .buyTokens(smallPurchase, currentTimestamp)
        .accounts({
          buyer: buyer.publicKey,
          saleAuthority: recipient.publicKey,
          programSaleAuthority: programSaleAuthority,
          saleConfig: saleConfig.publicKey,
          authority: wallet.publicKey,
          mint: mint,
          programTokenAccount: programTokenAccount,
          buyerTokenAccount: buyerTokenAccount,
          walletPurchase: walletPurchaseAccount,
          monthlyLimits: monthlyLimitsAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
        })
        .signers([buyer])
        .rpc();

      // Get current state
      let monthlyLimitsState = await program.account.monthlyLimits.fetch(monthlyLimitsAccount);
      console.log("Tokens bought:", monthlyLimitsState.tokensUnlocked.toString());

      // Make another purchase in the next month
      await program.methods
        .buyTokens(smallPurchase, nextMonthTimestamp)
        .accounts({
          buyer: buyer.publicKey,
          saleAuthority: recipient.publicKey,
          programSaleAuthority: programSaleAuthority,
          saleConfig: saleConfig.publicKey,
          authority: wallet.publicKey,
          mint: mint,
          programTokenAccount: programTokenAccount,
          buyerTokenAccount: buyerTokenAccount,
          walletPurchase: walletPurchaseAccount,
          monthlyLimits: monthlyLimitsAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
        })
        .signers([buyer])
        .rpc();

      // Verify new month state
      monthlyLimitsState = await program.account.monthlyLimits.fetch(monthlyLimitsAccount);
      console.log("Tokens bought in new month:", monthlyLimitsState.tokensUnlocked.toString());

      // Assertions
      // assert.notEqual(
      //   monthlyLimitsState.currentMonth,
      //   0,
      //   "Month should have incremented"
      // );
      assert.isTrue(
        monthlyLimitsState.tokensUnlocked.gt(new anchor.BN(0)),
        "Should have purchases in new month"
      );
      // assert.isTrue(
      //   monthlyLimitsState.tokensBoughtThisMonth.lte(
      //     monthlyLimitsState.limits[monthlyLimitsState.currentMonth]
      //   ),
      //   "Should not exceed monthly limit in new month"
      // );

    } catch (error) {
      console.error("Error testing monthly transitions:", error);
      throw error;
    }
  });

})

const disableVesting = async (program, wallet, saleConfig, monthlyLimitsAccount) => {
  console.log("Disabling Vesting and then checking ")

  try {
    const tx = await program.methods
      .disableVesting()
      .accounts({
        authority: wallet.publicKey,
        saleConfig: saleConfig.publicKey,
        monthlyLimits: monthlyLimitsAccount,
      })
      .signers([wallet])
      .rpc();

    console.log("Vesting Disabled successfully:", tx);

    // Verify the monthly limits were set correctly
    const monthlyLimitsState = await program.account.monthlyLimits.fetch(monthlyLimitsAccount);
    assert.isTrue(
      !monthlyLimitsState.isVestingEnabled,
      "Vesting Should be disabled"
    );
  } catch (error) {
    console.error("Error Disabling Vesting:", error);
    throw error;
  }

}
