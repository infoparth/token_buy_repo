tokenAddress = AFqeVXgZX3KWf2c2eUJM2YVEKFH2nR7PCLiCSAqsSrPp

# Anchor Program Deployment Guide

This document provides step-by-step instructions to deploy your Anchor program on the Solana blockchain.

## Prerequisites

Ensure you have the following installed and configured on your system:

1. **Node.js**: Verify by running `node -v`
2. **Solana CLI**: Verify by running `solana --version`
3. **Anchor CLI**: Verify by running `anchor --version`

## Steps to Deploy

### 1. Set Up Your Environment

1. **Clone the Project Repository**:
   ```bash
   git clone https://github.com/infoparth/token_buy_repo.git
   cd token-buy-repo
   ```

2. **Install Dependencies**:
   Use Yarn (preferred) or npm to install project dependencies:

   ```bash
   yarn install
   ```
   or
   ```bash
   npm install
   ```

3. **Configure Solana CLI**:
   Ensure you have a valid Solana wallet and network configuration:

   ```bash
   solana config set --url devnet
   ```
   You can also use `mainnet-beta` or `testnet` as per your requirements.

### 2. Deploy the Program

1. **Build the Program**:
   Run the following command to compile your program:

   ```bash
   anchor build
   ```

2. **Get the Program Address**:
   Retrieve the program's address from the generated keypair:

   ```bash
   solana address -k target/deploy/token_biu-keypair.json
   ```
   * The output of this command is the **program ID**. Note it down.

3. **Add the Program Address to the Code**:
   * Open your program's main Rust file (e.g., `lib.rs`)
   * Replace or add the program ID in the `declare_id!()` macro:

   ```rust
   declare_id!("YourProgramAddressHere");
   ```

4. **Build the Program Again**:
   Rebuild the program with the updated program ID:

   ```bash
   anchor build
   ```

5. **Deploy the Program**:
   Deploy the updated program to the Solana blockchain:

   ```bash
   anchor deploy
   ```

   If the deployment gives an insufficient funds error, please make sure to copy the wallet address, and get some devnet SOL, before deploying on devnet.

6. **Verify Deployment**:
   Run the following command to confirm your program is on-chain:

   ```bash
   solana program show <program-id>
   ```

### 3. Configure the Client

1. **Update Program ID**:
   Open `Anchor.toml` and update the `[programs.localnet.<program-name>]` entry with your program ID:

   ```toml
   [programs.localnet]
   <program-name> = "<your-program-id>"
   ```

2. **Update the IDL**:
   Anchor generates an IDL (Interface Definition Language) file automatically. The file is located in the `target/idl/` directory. Ensure you load the correct IDL in your frontend client.
