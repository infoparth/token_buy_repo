import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenBiu } from "../target/types/token_biu";
import {
  createMint,
  getAssociatedTokenAddress,
  mintTo,
  createAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
// import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";

describe("token_biu", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.TokenBiu as Program<TokenBiu>;
  const initialTokenLimit = 100000 * 1000000 ;
  let variableTokenLimit = 5000 * 1000000;

  // Dynamically create wallet 1 and wallet 2
  const wallet: Keypair = Keypair.generate();
  const buyer: Keypair = Keypair.generate();
  const recipient: Keypair = Keypair.generate();
  const newAuthority: Keypair = Keypair.generate();
  const newRecipient: Keypair = Keypair.generate();

  let saleConfig: Keypair;
  let mint: anchor.web3.PublicKey;
  let programSaleAuthority: anchor.web3.PublicKey;
  let programTokenAccount: anchor.web3.PublicKey;
  let buyerTokenAccount;

  const connection = provider.connection;
  const _provider_wallet = provider.wallet as anchor.Wallet;

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
        .initializeSale(tokenPriceUsd, mintDecimals, tokenLimit )
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

  it("Buys tokens", async () => {
    console.log("\n=======================================");
    console.log("Starting token purchase test...");
    console.log("=======================================");

    try {
      console.log("\n--- Getting associated token account for buyer ---");
      buyerTokenAccount = getAssociatedTokenAddressSync(mint, buyer.publicKey);
      console.log("Buyer token account:", buyerTokenAccount.toBase58(), "\n");

      console.log("\n--- Creating associated token account for Buyer ---");
      const ataInstruction = createAssociatedTokenAccountInstruction(
        buyer.publicKey, // Payer
        buyerTokenAccount, // Associated Token Account
        buyer.publicKey, // Off-curve owner
        mint // Token Mint
      );

      const transaction = new anchor.web3.Transaction().add(ataInstruction);

      await provider.sendAndConfirm(transaction, [buyer]);
      console.log("ATA created for Buyer:", buyerTokenAccount.toBase58(), "\n");
    } catch (error) {
      console.error("Error creating buyer's token account:", error);
      throw error;
    }

    try {
      console.log("\n--- Simulating token purchase ---");

      // Log pre-transaction balances
      const preBuyerBalance = await getAccount(
        provider.connection,
        buyerTokenAccount
      );
      const preProgramBalance = await getAccount(
        provider.connection,
        programTokenAccount
      );
      console.log(
        `Pre-Transaction Balances:\nBuyer: ${preBuyerBalance.amount}\nProgram: ${preProgramBalance.amount}\n`
      );

      const tx = await program.methods
        .buyTokens(new anchor.BN(LAMPORTS_PER_SOL))
        .accounts({
          buyer: buyer.publicKey,
          saleAuthority: recipient.publicKey,
          programSaleAuthority: programSaleAuthority,
          saleConfig: saleConfig.publicKey,
          authority: wallet.publicKey,
          mint: mint,
          programTokenAccount: programTokenAccount,
          buyerTokenAccount: buyerTokenAccount,
          // priceUpdate: SOLANA_PRICE_UPADTE_ACCOUNT,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram:
            anchor.utils.token.ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([buyer])
        .rpc();
      console.log("Token purchase transaction signature:", tx, "\n");

      // Log post-transaction balances
      const postBuyerBalance = await getAccount(
        provider.connection,
        buyerTokenAccount
      );
      const postProgramBalance = await getAccount(
        provider.connection,
        programTokenAccount
      );
      console.log(
        `Post-Transaction Balances:\nBuyer: ${postBuyerBalance.amount}\nProgram: ${postProgramBalance.amount}\n`
      );

      const tokensTransferred =
        BigInt(postBuyerBalance.amount) - BigInt(preBuyerBalance.amount);
      console.log(`Tokens Transferred: ${tokensTransferred}`);
    } catch (error) {
      console.error("Error during token purchase:", error);
      throw error;
    }
  });

  it("Changes the recipient account", async () => {
    console.log("\n=======================================");
    console.log("Changing recipient account...");
    console.log("=======================================");

    const tx = await program.methods
      .changeReciepentAccount(newRecipient.publicKey)
      .accounts({
        authority: wallet.publicKey,
        saleConfig: saleConfig.publicKey,
      })
      .signers([wallet])
      .rpc();
    console.log("Recipient account changed successfully:", tx, "\n");
  });

  it("Buys tokens", async () => {
    console.log("\n=======================================");
    console.log("Starting token purchase test after reciepent change...");
    console.log("=======================================");

    try {
      console.log("\n--- Getting associated token account for buyer ---");
      buyerTokenAccount = getAssociatedTokenAddressSync(mint, buyer.publicKey);
      console.log("Buyer token account:", buyerTokenAccount.toBase58(), "\n");
    } catch (error) {
      console.error("Error creating buyer's token account:", error);
      throw error;
    }

    try {
      console.log("\n--- Simulating token purchase ---");

      // Log pre-transaction balances
      const preBuyerBalance = await getAccount(
        provider.connection,
        buyerTokenAccount
      );
      const preProgramBalance = await getAccount(
        provider.connection,
        programTokenAccount
      );
      console.log(
        `Pre-Transaction Balances:\nBuyer: ${preBuyerBalance.amount}\nProgram: ${preProgramBalance.amount}\n`
      );

      console.log(
        "The pre balance of reciepent is: ",
        await provider.connection.getBalance(newRecipient.publicKey)
      );

      const tx = await program.methods
        .buyTokens(new anchor.BN(LAMPORTS_PER_SOL))
        .accounts({
          buyer: buyer.publicKey,
          saleAuthority: newRecipient.publicKey,
          programSaleAuthority: programSaleAuthority,
          saleConfig: saleConfig.publicKey,
          authority: wallet.publicKey,
          mint: mint,
          programTokenAccount: programTokenAccount,
          buyerTokenAccount: buyerTokenAccount,
          // priceUpdate: SOLANA_PRICE_UPADTE_ACCOUNT,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram:
            anchor.utils.token.ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([buyer])
        .rpc();
      console.log("Token purchase transaction signature:", tx, "\n");

      // Log post-transaction balances
      const postBuyerBalance = await getAccount(
        provider.connection,
        buyerTokenAccount
      );
      const postProgramBalance = await getAccount(
        provider.connection,
        programTokenAccount
      );
      console.log(
        `Post-Transaction Balances:\nBuyer: ${postBuyerBalance.amount}\nProgram: ${postProgramBalance.amount}\n`
      );

      console.log(
        "The post balance of reciepent is: ",
        await provider.connection.getBalance(newRecipient.publicKey)
      );

      const tokensTransferred =
        BigInt(postBuyerBalance.amount) - BigInt(preBuyerBalance.amount);
      console.log(`Tokens Transferred: ${tokensTransferred}`);
    } catch (error) {
      console.error("Error during token purchase:", error);
      throw error;
    }
  });

  it("Changes the token authority", async () => {
    console.log("\n=======================================");
    console.log("Changing token authority...");
    console.log("=======================================");

    const tx = await program.methods
      .changeConfigAuthority(newAuthority.publicKey)
      .accounts({
        authority: wallet.publicKey,
        saleConfig: saleConfig.publicKey,
      })
      .signers([wallet])
      .rpc();
    console.log("Token authority changed successfully:", tx, "\n");
  });

  it("Buys tokens", async () => {
    console.log("\n=======================================");
    console.log("Starting token purchase test after authority change...");
    console.log("=======================================");

    try {
      console.log("\n--- Getting associated token account for buyer ---");
      buyerTokenAccount = getAssociatedTokenAddressSync(mint, buyer.publicKey);
      console.log("Buyer token account:", buyerTokenAccount.toBase58(), "\n");
    } catch (error) {
      console.error("Error creating buyer's token account:", error);
      throw error;
    }

    try {
      console.log("\n--- Simulating token purchase ---");

      // Log pre-transaction balances
      const preBuyerBalance = await getAccount(
        provider.connection,
        buyerTokenAccount
      );
      const preProgramBalance = await getAccount(
        provider.connection,
        programTokenAccount
      );
      console.log(
        `Pre-Transaction Balances:\nBuyer: ${preBuyerBalance.amount}\nProgram: ${preProgramBalance.amount}\n`
      );

      console.log(
        "The pre balance of reciepent is: ",
        await provider.connection.getBalance(newRecipient.publicKey)
      );

      const tx = await program.methods
        .buyTokens(new anchor.BN(LAMPORTS_PER_SOL))
        .accounts({
          buyer: buyer.publicKey,
          saleAuthority: newRecipient.publicKey,
          programSaleAuthority: programSaleAuthority,
          saleConfig: saleConfig.publicKey,
          authority: newAuthority.publicKey,
          mint: mint,
          programTokenAccount: programTokenAccount,
          buyerTokenAccount: buyerTokenAccount,
          // priceUpdate: SOLANA_PRICE_UPADTE_ACCOUNT,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram:
            anchor.utils.token.ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([buyer])
        .rpc();
      console.log("Token purchase transaction signature:", tx, "\n");

      // Log post-transaction balances
      const postBuyerBalance = await getAccount(
        provider.connection,
        buyerTokenAccount
      );
      const postProgramBalance = await getAccount(
        provider.connection,
        programTokenAccount
      );
      console.log(
        `Post-Transaction Balances:\nBuyer: ${postBuyerBalance.amount}\nProgram: ${postProgramBalance.amount}\n`
      );

      console.log(
        "The post balance of reciepent is: ",
        await provider.connection.getBalance(newRecipient.publicKey)
      );

      const tokensTransferred =
        BigInt(postBuyerBalance.amount) - BigInt(preBuyerBalance.amount);
      console.log(`Tokens Transferred: ${tokensTransferred}`);
    } catch (error) {
      console.error("Error during token purchase:", error);
      throw error;
    }
  });

  it("Changes the Per Day Limit ", async () => {
    console.log("\n=======================================");
    console.log("Changing Per Day Limit to ...", variableTokenLimit);
    console.log("=======================================");

	let newTokenLimit = new anchor.BN(variableTokenLimit)

    const tx = await program.methods
      .setPurchaseLimit(newTokenLimit)
      .accounts({
        authority: newAuthority.publicKey,
        saleConfig: saleConfig.publicKey,
      })
      .signers([newAuthority])
      .rpc();
    console.log("Token Limit changed successfully:", tx, "\n");
  });

  it("Buys tokens", async () => {
    console.log("\n=======================================");
    console.log("Starting token purchase test after authority change...");
    console.log("=======================================");

    try {
      console.log("\n--- Getting associated token account for buyer ---");
      buyerTokenAccount = getAssociatedTokenAddressSync(mint, buyer.publicKey);
      console.log("Buyer token account:", buyerTokenAccount.toBase58(), "\n");
    } catch (error) {
      console.error("Error creating buyer's token account:", error);
      throw error;
    }

    try {
      console.log("\n--- Simulating token purchase ---");

      // Log pre-transaction balances
      const preBuyerBalance = await getAccount(
        provider.connection,
        buyerTokenAccount
      );
      const preProgramBalance = await getAccount(
        provider.connection,
        programTokenAccount
      );
      console.log(
        `Pre-Transaction Balances:\nBuyer: ${preBuyerBalance.amount}\nProgram: ${preProgramBalance.amount}\n`
      );

      console.log(
        "The pre balance of reciepent is: ",
        await provider.connection.getBalance(newRecipient.publicKey)
      );

      const tx = await program.methods
        .buyTokens(new anchor.BN(LAMPORTS_PER_SOL))
        .accounts({
          buyer: buyer.publicKey,
          saleAuthority: newRecipient.publicKey,
          programSaleAuthority: programSaleAuthority,
          saleConfig: saleConfig.publicKey,
          authority: newAuthority.publicKey,
          mint: mint,
          programTokenAccount: programTokenAccount,
          buyerTokenAccount: buyerTokenAccount,
          // priceUpdate: SOLANA_PRICE_UPADTE_ACCOUNT,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram:
            anchor.utils.token.ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([buyer])
        .rpc();
      console.log("Token purchase transaction signature:", tx, "\n");

      // Log post-transaction balances
      const postBuyerBalance = await getAccount(
        provider.connection,
        buyerTokenAccount
      );
      const postProgramBalance = await getAccount(
        provider.connection,
        programTokenAccount
      );
      console.log(
        `Post-Transaction Balances:\nBuyer: ${postBuyerBalance.amount}\nProgram: ${postProgramBalance.amount}\n`
      );

      console.log(
        "The post balance of reciepent is: ",
        await provider.connection.getBalance(newRecipient.publicKey)
      );

      const tokensTransferred =
        BigInt(postBuyerBalance.amount) - BigInt(preBuyerBalance.amount);
      console.log(`Tokens Transferred: ${tokensTransferred}`);
    } catch (error) {
      console.error("Error during token purchase:", error);
      throw error;
    }
  });



});
