
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

console.clear()

describe("token_biu", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.TokenBiu as Program<TokenBiu>;
  const initialTokenLimit = 1000000000 * 1000000;
  let variableTokenLimit = 10000000 * 1000000;

  // Dynamically create wallet 1 and wallet 2
  // const wallet: Keypair = Keypair.generate();
  // const buyer: Keypair = Keypair.generate();
  //
  const wallet = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(path.join(__dirname, "wallet.json"), "utf-8")))
  );
  const buyer = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(path.join(__dirname, "buyer.json"), "utf-8")))
  );
  const recipient = new anchor.web3.PublicKey("6Aa35EE5yEoCuRPgdhzXdvYKGFVLXeeLjDBx6h35g3oh");

  let saleConfig: Keypair;
  saleConfig = anchor.web3.Keypair.generate();
  let mint: anchor.web3.PublicKey;
  let programSaleAuthority: anchor.web3.PublicKey;
  let programTokenAccount: anchor.web3.PublicKey;
  let buyerTokenAccount;
  let adminTokenAccount;

  const currentTimestamp = new anchor.BN(Math.floor(Date.now() / 1000));

  const monthlyValues = [300, 200, 50, 700, 280, 220, 180, 500, 300, 231, 900, 560, 10000, 10000];

  const timestamps = generateTestTimestamps();

  // Calculate total tokens needed for all months
  const totalMonthlyLimits = monthlyValues.reduce((sum, val) => sum + val, 0) * 1000000;

  // Fund the buyer with enough SOL for all tests
  const BUYER_SOL_AMOUNT = 100 * LAMPORTS_PER_SOL;

  before(async () => {
    console.log("The wallet and buyer key is: ", wallet.publicKey.toString(), buyer.publicKey.toString());
    console.log("\n=======================================");
    console.log("Starting setup in `before` hook...");
    console.log("=======================================");

    try {
      //   console.log("\n--- Requesting SOL airdrop for wallet and buyer ---");
      //   await Promise.all([
      //     provider.connection.requestAirdrop(
      //       wallet.publicKey,
      //       50 * LAMPORTS_PER_SOL
      //     ),
      //     provider.connection.requestAirdrop(
      //       buyer.publicKey,
      //       BUYER_SOL_AMOUNT
      //     ),
      //   ]).then((signatures) =>
      //     Promise.all(
      //       signatures.map((sig) => provider.connection.confirmTransaction(sig))
      //     )
      //   );
      //   console.log("Airdrop completed.\n");
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
          recipient: recipient,
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


      console.log("\n--- Creating admin token account ---");
      adminTokenAccount = await getAssociatedTokenAddress(
        mint,
        wallet.publicKey
      );

      // Create the token account if it doesn't exist
      const admminAtaInstruction = createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        adminTokenAccount,
        wallet.publicKey,
        mint
      );

      try {
        const transaction = new anchor.web3.Transaction().add(ataInstruction).add(admminAtaInstruction);
        await provider.sendAndConfirm(transaction, [buyer, wallet]);
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
    [Buffer.from("monthly_limits_a")],
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
    const bnTimestamps = timestamps.map(value => new anchor.BN(value));

    // Add event listener for MonthlyLimitsSet
    const listener = program.addEventListener(
      "MonthlyLimitsSet",
      (event, _slot) => {
        console.log("MonthlyLimitsSet event emitted:", event);
        assert.deepEqual(event.limits, monthlyLimits);
      }
    );

    console.log("Listener added")

    try {
      const tx = await program.methods
        .setMonthlyLimits(monthlyLimits, bnTimestamps)
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
      // monthlyLimitsState.limits.map((value, key) => console.log(`The limit value for month ${key}, is ${value / 1e6}`));
      // monthlyLimitsState.timestamps.map((value, key) => console.log(`The timestamp for month ${key}, is ${value}`));

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

    let cumulativeLimit = 0;

    let preBalance = 0;


    for (let month = 0; month < 16; month++) {

      // if (month % 2 == 0) {
      //   rem = 20;
      // }
      // else {
      //   rem = -20
      // }

      let monthlyTimestamp = currentTimestamp.add(new anchor.BN(month * 2629743)); // ~1 month in seconds

      // Condition to check sale not started condition

      // if (month === 0) {
      //   monthlyTimestamp = currentTimestamp.sub(new anchor.BN(2629743))
      // }

      let expectedSol = 0.02;

      if (month < 14) {

        expectedSol = calcluateSolAmount(monthlyValues[month]);
      }

      // if (month === 0) {
      //   expectedSol = 8;
      // }
      //
      // if (month === 1) {
      //   expectedSol = 9;
      // }

      // if (month === 11) {
      //   expectedSol += 0.000001;
      // }

      if (month === 12) {
        // solForPurchase = 0.02;
      }
      if (month === 13) {
        // solForPurchase = 0.02;
        monthlyTimestamp = currentTimestamp.add(new anchor.BN((10 + month) * 2629743));
      }


      let date = new Date(monthlyTimestamp.toNumber() * 1000); // Convert to milliseconds

      // Extract month and year
      let year = date.getUTCFullYear();
      let monthName = date.toLocaleString('default', { month: 'long' });

      console.log(`\n--- Testing Month ${month} ---\n`);

      console.log(`The timestamp corresponds to: ${monthName} ${year}`);

      try {


        // let monthlyLimitsStatePrior = await program.account.monthlyLimits.fetch(monthlyLimitsAccount);
        //
        // console.log("The Month limits prior are: ",)

        // Make a purchase below the limit
        console.log(`\nMaking purchase for month ${month} \n`);

        if (false) {
          console.log("\n==========================++++++=====================================\n")
          console.log("Starting token withdraw for admin")
          try {

            const remTokens = await program.account.monthlyLimits.fetch(monthlyLimitsAccount);
            let rem = remTokens.tokensAvailable;
            let monthlyLimit = new anchor.BN(monthlyValues[month] * 1000000);
            let totalWithdrawAmount = rem.add(monthlyLimit);

            console.log("Total withdrawal amount should be: ", totalWithdrawAmount.toNumber() / 1e6)


            console.log("Withdrawing ", rem.toNumber() / 1e6, " tokens");

            const tx = await program.methods
              .withdrawTokens(totalWithdrawAmount)
              .accounts({
                saleConfig: saleConfig.publicKey,
                authority: wallet.publicKey,
                monthlyLimits: monthlyLimitsAccount,
                programTokenAccount: programTokenAccount,
                programSaleAuthority: programSaleAuthority,
                mint: mint,
                adminTokenAccount: adminTokenAccount,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
              })
              .signers([wallet])
              .rpc();





            console.log("Tx successfull: ", tx)

            const _remTokens = await program.account.monthlyLimits.fetch(monthlyLimitsAccount);

            const accountInfo = await provider.connection.getTokenAccountBalance(adminTokenAccount);
            console.log("")
            console.log(`Admin Token Balance: ${accountInfo.value.amount}`);

            console.log(_remTokens.tokensWithdrawn.toNumber() / 1e6, " Tokens Withdrawal successfull")
            console.log("\n==========================++++++=====================================\n")

            continue;

          } catch (error) {
            console.log("Failed to withdraw tokens for admin: ", error)
            continue;

          }
        }

        await program.methods
          .buyTokens(new anchor.BN(expectedSol * LAMPORTS_PER_SOL), monthlyTimestamp)
          .accounts({
            buyer: buyer.publicKey,
            saleAuthority: recipient,
            programSaleAuthority: programSaleAuthority,
            saleConfig: saleConfig.publicKey,
            authority: wallet.publicKey,
            mint: mint,
            programTokenAccount: programTokenAccount,
            buyerTokenAccount: buyerTokenAccount,
            // walletPurchase: walletPurchaseAccount,
            monthlyLimits: monthlyLimitsAccount,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
          })
          .signers([buyer])
          .rpc();

        let monthlyLimitsState = await program.account.monthlyLimits.fetch(monthlyLimitsAccount);
        // console.log("The raw timestamp is: ", monthlyLimitsState.demoTime.toNumber())

        // let date = new Date(monthlyLimitsState.demoTime.toNumber() * 1000); // Convert to milliseconds

        // // Extract month and year
        // let year = date.getUTCFullYear();
        // let monthName = date.toLocaleString('default', { month: 'long' });
        // console.log("The current month according to contract is: ", monthName, year)

        // Verify monthly limits state
        // console.log("Total tokens unlocked uptill this point are: ", monthlyLimitsState.tokensUnlocked.toNumber() / 1e6);
        // console.log("\nTotal tokens available uptill this point are: ", monthlyLimitsState.tokensAvailable.toNumber() / 1e6);
        if (month < 14) {
          console.log(`\nMonth limit: ${monthlyLimitsState.limits[month].toNumber() / 1e6}\n`);
          cumulativeLimit += monthlyLimitsState.limits[month].toNumber();
        }
        console.log(`\nTokens bought in ${month} are: `, (monthlyLimitsState.tokensUnlocked.toNumber() - preBalance) / 1e6, "\n");
        console.log(`\nTotal tokens available are:  ${monthlyLimitsState.tokensAvailable.toNumber() / 1e6}\n`);
        console.log(`\nTotal Tokens Withdrawan are:  ${monthlyLimitsState.tokensWithdrawn.toNumber() / 1e6}\n`);


        // assert.isTrue(
        //   monthlyLimitsState.tokensUnlocked.gt(new anchor.BN(0)),
        //   "Tokens bought this month should be greater than 0"
        // );
        //
        //
        // assert.isTrue(
        //   monthlyLimitsState.tokensUnlocked.toNumber() <= cumulativeLimit,
        //   "Tokens bought should be less than monthly limit"
        // );

        monthlyLimitsState = await program.account.monthlyLimits.fetch(monthlyLimitsAccount);

        console.log(`Total tokens bought: ${monthlyLimitsState.tokensUnlocked.toNumber() / 1e6}`);

        preBalance = monthlyLimitsState.tokensUnlocked.toNumber();

        // assert.isTrue(
        //   monthlyLimitsState.tokensUnlocked.toNumber() <= cumulativeLimit,
        //   "Should not exceed monthly limit"
        // );


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

function generateTestTimestamps(): number[] {
  const timestamps: number[] = [];
  const now = new Date();

  timestamps.push(Math.floor(now.getTime() / 1000));

  for (let i = 1; i <= 12; i++) {
    const nextMonth = new Date(now);
    nextMonth.setMonth(now.getMonth() + i);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);
    timestamps.push(Math.floor(nextMonth.getTime() / 1000));
  }

  const sixthMonthNextYear = new Date(now);
  sixthMonthNextYear.setFullYear(now.getFullYear() + 1);
  sixthMonthNextYear.setMonth(5);
  sixthMonthNextYear.setDate(1);
  sixthMonthNextYear.setHours(0, 0, 0, 0);
  timestamps.push(Math.floor(sixthMonthNextYear.getTime() / 1000));

  // const twelfthMonthNextYear = new Date(now);
  // twelfthMonthNextYear.setFullYear(now.getFullYear() + 1);
  // twelfthMonthNextYear.setMonth(11);
  // twelfthMonthNextYear.setDate(1);
  // twelfthMonthNextYear.setHours(0, 0, 0, 0);
  // timestamps.push(Math.floor(twelfthMonthNextYear.getTime() / 1000));

  return timestamps;
}


const calcluateSolAmount = (amount: number): number => {

  const tokenPrice = 0.005;
  const solUsd = 190;

  const valueOfTokensInUSD = amount * tokenPrice;
  const expectedSol = (valueOfTokensInUSD / solUsd);



  return expectedSol;

}

const remainigTokens = (monthlyLimit: number, unlockedAmountLastMonth: number): number => {

  if (unlockedAmountLastMonth === 0) {
    return 0;
  }

  return monthlyLimit - unlockedAmountLastMonth;

}
