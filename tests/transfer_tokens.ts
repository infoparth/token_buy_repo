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
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";

describe("token_biu", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.TokenBiu as Program<TokenBiu>;

  // Dynamically create wallet 1 and wallet 2
  const wallet: Keypair = Keypair.generate();
  const buyer: Keypair = Keypair.generate();
  const recipient: Keypair = Keypair.generate();

  let saleConfig: Keypair;
  let mint: anchor.web3.PublicKey;
  let programSaleAuthority: anchor.web3.PublicKey;
  let programTokenAccount: anchor.web3.PublicKey;
  let buyerTokenAccount;

  const connection = provider.connection;
  const _provider_wallet = provider.wallet as anchor.Wallet;

  const pythSolanaReceiver = new PythSolanaReceiver({
    connection,
    wallet: _provider_wallet,
  });
  const SOL_USD_FEED_ID =
    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

  const solUsdPriceFeedAccount = pythSolanaReceiver.getPriceFeedAccountAddress(
    0,
    SOL_USD_FEED_ID
  );

  console.log(solUsdPriceFeedAccount);

  before(async () => {
    console.log("Starting setup in `before` hook...");

    try {
      console.log("Requesting SOL airdrop for wallet and buyer...");
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
      console.log("Airdrop completed.");
      console.log(
        "The balance of wallet is: ",
        await provider.connection.getBalance(wallet.publicKey)
      );
      console.log(
        "The balance of buyer is: ",
        await provider.connection.getBalance(buyer.publicKey)
      );
      console.log(
        "The balance of reciepent is: ",
        await provider.connection.getBalance(recipient.publicKey)
      );
    } catch (error) {
      console.error("Error during SOL airdrop:", error);
    }

    try {
      console.log("Creating token mint...");
      mint = await createMint(
        provider.connection,
        wallet,
        wallet.publicKey,
        null,
        6
      );

      console.log("Token mint created successfully:", mint.toBase58());
    } catch (error) {
      console.error("Error during token mint creation:", error);
      throw error;
    }

    try {
      console.log("Finding program sale authority PDA...");
      const [authority, bump] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("sale_authority")],
        program.programId
      );
      programSaleAuthority = authority;
      console.log(
        "Program sale authority PDA:",
        programSaleAuthority.toBase58()
      );
    } catch (error) {
      console.error("Error finding PDA for sale authority:", error);
      throw error;
    }

    try {
      console.log(
        "Getting associated token account for program sale authority..."
      );
      programTokenAccount = getAssociatedTokenAddressSync(
        mint,
        programSaleAuthority,
        true // allowOwnerOffCurve
      );
      console.log("Program token account:", programTokenAccount.toBase58());

      console.log(
        "Creating associated token account for program sale authority..."
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
        programTokenAccount.toBase58()
      );

      console.log("Associated token account:", programTokenAccount.toBase58());
    } catch (error) {
      console.error("Error getting associated token account:", error);
      throw error;
    }

    try {
      console.log("Initializing sale configuration...");
      saleConfig = anchor.web3.Keypair.generate();
      const tokenPriceUsd = 0.005;
      const mintDecimals = new anchor.BN(6);

      await program.methods
        .initializeSale(tokenPriceUsd, mintDecimals)
        .accounts({
          authority: wallet.publicKey,
          saleConfig: saleConfig.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          recipient: recipient.publicKey,
        })
        .signers([wallet, saleConfig])
        .rpc();
      console.log("Sale configuration initialized successfully.");
    } catch (error) {
      console.error("Error during sale initialization:", error);
      throw error;
    }

    try {
      console.log("Minting tokens to program token account...");
      const DECIMALS = 6;
      const TOKEN_PRICE_USD = 0.005;
      const SOL_PRICE_USD = 190.0;

      // Calculate how many tokens we need
      const solAmount = LAMPORTS_PER_SOL; // 1 SOL
      const solAmountUsd = (solAmount * SOL_PRICE_USD) / 1e9;
      const expectedTokenAmount =
        (solAmountUsd / TOKEN_PRICE_USD) * Math.pow(10, DECIMALS);
      const MINT_AMOUNT = expectedTokenAmount * 2; // Mint double what we need

      console.log(`Minting ${MINT_AMOUNT} tokens to program account...`);
      await mintTo(
        provider.connection,
        wallet,
        mint,
        programTokenAccount,
        wallet.publicKey,
        MINT_AMOUNT
      );

      // Verify the balance
      const tokenAccount = await getAccount(
        provider.connection,
        programTokenAccount
      );
      console.log(`Program token account balance: ${tokenAccount.amount}`);
      console.log("Tokens Minted Successfully");
    } catch (error) {
      console.error("Error during token minting:", error);
      throw error;
    }
  });

  it("Buys tokens", async () => {
    console.log("Starting token purchase test...");

    try {
      console.log("Getting associated token account for buyer...");
      buyerTokenAccount = getAssociatedTokenAddressSync(mint, buyer.publicKey);
      console.log("Buyer token account:", buyerTokenAccount.toBase58());

      console.log("Creating associated token account for Buyer...");
      const ataInstruction = createAssociatedTokenAccountInstruction(
        buyer.publicKey, // Payer
        buyerTokenAccount, // Associated Token Account
        buyer.publicKey, // Off-curve owner
        mint // Token Mint
      );

      const transaction = new anchor.web3.Transaction().add(ataInstruction);

      await provider.sendAndConfirm(transaction, [buyer]);
      console.log("ATA created for Buyer :", buyerTokenAccount.toBase58());
    } catch (error) {
      console.error("Error creating buyer's token account:", error);
      throw error;
    }

    try {
      console.log("Simulating token purchase...");

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
        `Pre-Transaction Balances:\nBuyer: ${preBuyerBalance.amount}\nProgram: ${preProgramBalance.amount}`
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
          priceUpdate: solUsdPriceFeedAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram:
            anchor.utils.token.ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([buyer])
        .rpc();
      console.log("Token purchase transaction signature:", tx);

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
        `Post-Transaction Balances:\nBuyer: ${postBuyerBalance.amount}\nProgram: ${postProgramBalance.amount}`
      );

      // Log token transfer amount
      const tokensTransferred =
        BigInt(postBuyerBalance.amount) - BigInt(preBuyerBalance.amount);
      console.log(`Tokens Transferred: ${tokensTransferred}`);
      console.log(
        "The Post balance of wallet is: ",
        await provider.connection.getBalance(wallet.publicKey)
      );
      console.log(
        "The post balance of buyer is: ",
        await provider.connection.getBalance(buyer.publicKey)
      );
      console.log(
        "The post balance of reciepent is: ",
        await provider.connection.getBalance(recipient.publicKey)
      );
    } catch (error) {
      console.error("Error during token purchase:", error);
      throw error;
    }
  });
});
