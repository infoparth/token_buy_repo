
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
import fs from "fs";
import path from "path";

describe("token_biu", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.TokenBiu as Program<TokenBiu>;
  const initialTokenLimit = 10000000 * 1000000;
  let variableTokenLimit = 10000000 * 1000000;

  // Dynamically create wallet 1 and wallet 2
  // const wallet: Keypair = Keypair.generate();
  // const buyer: Keypair = Keypair.generate();
  // const wallet: Keypair = Keypair.fromSecretKey(
  //   new Uint8Array(JSON.parse(fs.readFileSync("./wallet.json", "utf-8")))
  // );
  // const buyer: Keypair = Keypair.fromSecretKey(
  //   new Uint8Array(JSON.parse(fs.readFileSync("./buyer.json", "utf-8")))
  // );
   const wallet = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(path.join(__dirname, "wallet.json"), "utf-8")))
  );
  const buyer = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(path.join(__dirname, "buyer.json"), "utf-8")))
  );
  const recipient: Keypair = Keypair.generate();
  const newAuthority: Keypair = Keypair.generate();
  const newRecipient: Keypair = Keypair.generate();
  const pubKey = buyer.publicKey;

  let saleConfig: Keypair;
  saleConfig = anchor.web3.Keypair.generate();
  let mint: anchor.web3.PublicKey;
  let programSaleAuthority: anchor.web3.PublicKey;
  let programTokenAccount: anchor.web3.PublicKey;
  let buyerTokenAccount;

  const currentTimestamp = new anchor.BN(Math.floor(Date.now() / 1000));

  // Monthly values for testing - in tokens with 6 decimals (e.g., 10000 * 1000000 = 10,000,000,000)
  const monthlyValues = [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 6000, 6000];

  // Fund the buyer with enough SOL for all tests
  const BUYER_SOL_AMOUNT = 100 * LAMPORTS_PER_SOL;

  before(async () => {
    console.log("\n=======================================");
    console.log("Starting setup in `before` hook...");
    console.log("=======================================");

    try {
      // console.log("\n--- Requesting SOL airdrop for wallet and buyer ---");
      // await Promise.all([
      //   provider.connection.requestAirdrop(
      //     wallet.publicKey,
      //     5 * LAMPORTS_PER_SOL
      //   ),
      //   provider.connection.requestAirdrop(
      //     buyer.publicKey,
      //     BUYER_SOL_AMOUNT
      //   ),
      // ]).then((signatures) =>
      //   Promise.all(
      //     signatures.map((sig) => provider.connection.confirmTransaction(sig))
      //   )
      // );
      // console.log("Airdrop completed.\n");
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
    const totalLocked = new anchor.BN(24000 * 1000000);

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
        .setMonthlyLimits(monthlyLimits, totalLocked)
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

    let cumulativeLimit = 0;
    let solForPurchase = 0.02;
    let preBalance = 0;

    for (let month = 0; month < 14; month++) {

      let monthlyTimestamp = currentTimestamp.add(new anchor.BN(month * 2629743)); // ~1 month in seconds
      let hourlyTimestamp = currentTimestamp.add(new anchor.BN(month * 3600)); // ~1 month in seconds
      if (month === 12) {
        solForPurchase = 0.2;
      }
      if (month === 13) {
        solForPurchase = 0.19;
        monthlyTimestamp = currentTimestamp.add(new anchor.BN((8 + month) * 2629743));
      }

      console.log(`\n Testing Month according to timestamp ---\n`, (monthlyTimestamp.toNumber() / 2629743) % 12);
      console.log(`\n--- Testing Month ${month} ---\n`);

      try {
        // Reset the month if needed
        // if (month > 0) {
        //   console.log(`Warping to month ${month} timestamp: ${monthTimestamp.toString()}`);
        //   await testMonthChange(month, hourlyTimestamp);
        // }

        // Make a purchase below the limit
        console.log(`\nMaking purchase below limit for month ${month} \n`);
        await program.methods
          .buyTokens(new anchor.BN(solForPurchase * LAMPORTS_PER_SOL), monthlyTimestamp)
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
        console.log(`Tokens bought in ${month} are: `, (monthlyLimitsState.tokensUnlocked.toNumber() - preBalance) / 1e6);
        console.log(`Tokens bought in month ${month}: ${monthlyLimitsState.tokensUnlocked.toString()}`);
        console.log(`\nMonth limit: ${monthlyLimitsState.limits[month].toString()}\n`);
        preBalance = monthlyLimitsState.tokensUnlocked.toNumber();


        assert.isTrue(
          monthlyLimitsState.tokensUnlocked.gt(new anchor.BN(0)),
          "Tokens bought this month should be greater than 0"
        );

        cumulativeLimit += monthlyLimitsState.limits[month].toNumber();

        assert.isTrue(
          monthlyLimitsState.tokensUnlocked.toNumber() <= cumulativeLimit,
          "Tokens bought should be less than monthly limit"
        );

        // Test limit enforcement with additional purchase
        try {
          // console.log("\nTesting limit enforcement with additional purchase\n");
          // await program.methods
          //   .buyTokens(smallPurchase, monthlyTimestamp)
          //   .accounts({
          //     buyer: buyer.publicKey,
          //     saleAuthority: recipient.publicKey,
          //     programSaleAuthority: programSaleAuthority,
          //     saleConfig: saleConfig.publicKey,
          //     authority: wallet.publicKey,
          //     mint: mint,
          //     programTokenAccount: programTokenAccount,
          //     buyerTokenAccount: buyerTokenAccount,
          //     walletPurchase: walletPurchaseAccount,
          //     monthlyLimits: monthlyLimitsAccount,
          //     systemProgram: anchor.web3.SystemProgram.programId,
          //     tokenProgram: TOKEN_PROGRAM_ID,
          //     associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
          //   })
          //   .signers([buyer])
          //   .rpc();

          // Check if we're still under the limit
          monthlyLimitsState = await program.account.monthlyLimits.fetch(monthlyLimitsAccount);
          console.log(`Updated tokens bought: ${monthlyLimitsState.tokensUnlocked.toString()}`);

          let tokensRemaining = ((month + 1) * monthlyLimitsState.limits[month].toNumber()) - monthlyLimitsState.tokensUnlocked.toNumber()
          console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++")

          console.log(`\nTokens Remaining for month ${month} are: ${tokensRemaining / 1e6}\n`);
          console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++")
          assert.isTrue(
            monthlyLimitsState.tokensUnlocked.toNumber() <= cumulativeLimit,
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
      // solForPurchase += 0.01;
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

    return afterState;
  }
});
