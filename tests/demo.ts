
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenBiu } from "../target/types/token_biu";
import {
  createMint,
  getAssociatedTokenAddress,
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

describe("token_biu", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.TokenBiu as Program<TokenBiu>;
  const initialTokenLimit = 10000000 * 1000000;
  let variableTokenLimit = 10000000 * 1000000;

  // Dynamically create wallet 1 and wallet 2
  const wallet: Keypair = Keypair.generate();
  const buyer: Keypair = Keypair.generate();
  const recipient: Keypair = Keypair.generate();
  const newAuthority: Keypair = Keypair.generate();
  const newRecipient: Keypair = Keypair.generate();
  const pubKey = buyer.publicKey;

  let saleConfig: Keypair;
  let mint: anchor.web3.PublicKey;
  let programSaleAuthority: anchor.web3.PublicKey;
  let programTokenAccount: anchor.web3.PublicKey;
  let buyerTokenAccount;

  const connection = provider.connection;
  const _provider_wallet = provider.wallet as anchor.Wallet;

  const currentTimestamp = new anchor.BN(Math.floor(Date.now() / 1000));

  // Monthly values for testing - in tokens with 6 decimals (e.g., 10000 * 1000000 = 10,000,000,000)
  const monthlyValues = [10000, 5000, 2000, 1000, 10000, 50000, 81110, 5000, 5000, 5000, 5000, 1000];

  // Fund the buyer with enough SOL for all tests
  const BUYER_SOL_AMOUNT = 100 * LAMPORTS_PER_SOL;

  before(async () => {
    console.log("\n=======================================");
    console.log("Starting setup in `before` hook...");
    console.log("=======================================");

    try {
      console.log("\n--- Requesting SOL airdrop for wallet and buyer ---");
      await Promise.all([
        provider.connection.requestAirdrop(
          wallet.publicKey,
          5 * LAMPORTS_PER_SOL
        ),
        provider.connection.requestAirdrop(
          buyer.publicKey,
          BUYER_SOL_AMOUNT
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
      console.log("\n--- Creating buyer token account ---");
      buyerTokenAccount = await getAssociatedTokenAddress(
        mint,
        buyer.publicKey
      );

      // Create the token account if it doesn't exist
      const ataInstruction = createAssociatedTokenAccountInstruction(
        buyer.publicKey,
        buyerTokenAccount,
        buyer.publicKey,
        mint
      );

      try {
        const transaction = new anchor.web3.Transaction().add(ataInstruction);
        await provider.sendAndConfirm(transaction, [buyer]);
        console.log("Buyer token account created:", buyerTokenAccount.toBase58());
      } catch (error) {
        // Account might already exist, which is fine
        console.log("Buyer token account may already exist");
      }
    } catch (error) {
      console.error("Error creating buyer token account:", error);
      throw error;
    }

    try {
      console.log("\n--- Minting tokens to program token account ---");
      const DECIMALS = 6;
      const TOKEN_PRICE_USD = 0.005;
      const SOL_PRICE_USD = 190.0;

      // Calculate total tokens needed for all months
      const totalMonthlyLimits = monthlyValues.reduce((sum, val) => sum + val, 0) * 1000000;

      // Add extra tokens for safety
      const MINT_AMOUNT = totalMonthlyLimits * 2;

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

  const [monthlyLimitsAccount, monthlyLimitsBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("monthly_limits")],
    program.programId
  );

  const [walletPurchaseAccount] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("wallet_purchase"), buyer.publicKey.toBuffer()],
    program.programId
  );

  it("Sets monthly limits", async () => {
    console.log("\n=======================================");
    console.log("Setting monthly limits...");
    console.log("=======================================");

    const monthlyLimits = monthlyValues.map(value => new anchor.BN(value * 1000000));

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
        .setMonthlyLimits(monthlyLimits)
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
        monthlyLimitsState.tokensBoughtThisMonth.toNumber() == 0,
        "Tokens bought this month should be 0"
      );
    } catch (error) {
      console.error("Error setting monthly limits:", error);
      throw error;
    } finally {
      program.removeEventListener(listener);
    }
  });

  it("Tests purchase and limits for all 12 months", async () => {
    console.log("\n=======================================");
    console.log("Testing purchase and limits for all 12 months...");
    console.log("=======================================");

    const DECIMALS = 6;
    const TOKEN_PRICE_USD = 0.005;
    const SOL_PRICE_USD = 190.0;

    // Calculate purchase amounts that get just below the limit for each month
    const monthlyPurchaseAmounts = monthlyValues.map(monthLimit => {
      // Calculate SOL amount needed to buy slightly less than the monthly limit
      const tokensToGet = monthLimit * 1000000 * 0.9; // 90% of the limit
      const usdAmount = tokensToGet * TOKEN_PRICE_USD / Math.pow(10, DECIMALS);
      const solAmount = (usdAmount / SOL_PRICE_USD) * LAMPORTS_PER_SOL;
      return new anchor.BN(Math.floor(solAmount));
    });

    // Small additional purchase to test limit enforcement
    const smallPurchase = new anchor.BN(0.002 * LAMPORTS_PER_SOL);

    for (let month = 0; month < 12; month++) {
      console.log(`\n--- Testing Month ${month} ---`);
      const monthTimestamp = currentTimestamp.add(new anchor.BN(month * 2629743)); // ~1 month in seconds
      const hourlyTimestamp = currentTimestamp.add(new anchor.BN(month * 3600)); // ~1 month in seconds

      try {
        // Reset the month if needed
        if (month > 0) {
          console.log(`Warping to month ${month} timestamp: ${monthTimestamp.toString()}`);
          await testMonthChange(month, hourlyTimestamp);
        }

        // Make a purchase below the limit
        console.log(`Making purchase below limit for month ${month}`);
        await program.methods
          .buyTokens(new anchor.BN(0.02 * LAMPORTS_PER_SOL), hourlyTimestamp)
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

        // Verify monthly limits state
        let monthlyLimitsState = await program.account.monthlyLimits.fetch(monthlyLimitsAccount);
        console.log(`Current month: ${monthlyLimitsState.currentMonth}`);
        console.log(`Tokens bought this month: ${monthlyLimitsState.tokensBoughtThisMonth.toString()}`);
        console.log(`Month limit: ${monthlyLimitsState.limits[monthlyLimitsState.currentMonth].toString()}`);

        assert.equal(
          monthlyLimitsState.currentMonth,
          month,
          `Current month should be ${month}`
        );

        assert.isTrue(
          monthlyLimitsState.tokensBoughtThisMonth.gt(new anchor.BN(0)),
          "Tokens bought this month should be greater than 0"
        );

        assert.isTrue(
          monthlyLimitsState.tokensBoughtThisMonth.lt(
            monthlyLimitsState.limits[monthlyLimitsState.currentMonth]
          ),
          "Tokens bought should be less than monthly limit"
        );

        // Test limit enforcement with additional purchase
        try {
          console.log("Testing limit enforcement with additional purchase");
          await program.methods
            .buyTokens(smallPurchase, hourlyTimestamp)
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

          // Check if we're still under the limit
          monthlyLimitsState = await program.account.monthlyLimits.fetch(monthlyLimitsAccount);
          console.log(`Updated tokens bought: ${monthlyLimitsState.tokensBoughtThisMonth.toString()}`);

          assert.isTrue(
            monthlyLimitsState.tokensBoughtThisMonth.lte(
              monthlyLimitsState.limits[monthlyLimitsState.currentMonth]
            ),
            "Should not exceed monthly limit"
          );
        } catch (error) {
          if (error.message.includes("MonthlyLimitExceeded")) {
            console.log("Correctly rejected purchase that would exceed monthly limit");
          } else {
            throw error;
          }
        }

      } catch (error) {
        console.error(`Error testing month ${month}:`, error);
        throw error;
      }
    }
  });

  async function testMonthChange(expectedMonth: number, newTimestamp: anchor.BN) {
    const smallPurchase = new anchor.BN(0.001 * LAMPORTS_PER_SOL);

    // Get current state before change
    const beforeState = await program.account.monthlyLimits.fetch(monthlyLimitsAccount);

    // Make a purchase with the new timestamp
    await program.methods
      .buyTokens(smallPurchase, newTimestamp)
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
    const afterState = await program.account.monthlyLimits.fetch(monthlyLimitsAccount);

    assert.equal(
      afterState.currentMonth,
      expectedMonth,
      `Month should have changed to ${expectedMonth}`
    );

    if (beforeState.currentMonth !== afterState.currentMonth) {
      assert.isTrue(
        afterState.tokensBoughtThisMonth.lt(beforeState.tokensBoughtThisMonth),
        "Tokens bought should reset for new month"
      );
    }

    return afterState;
  }
});
