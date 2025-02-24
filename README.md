---
# Anchor Program Deployment Guide

Welcome to the **Anchor Program Deployment Guide**! This document provides a step-by-step walkthrough to deploy your Anchor program on the Solana blockchain. Whether you're a seasoned developer or just getting started, this guide will help you navigate the process with ease.
---

## 🛠️ Prerequisites

Before diving into deployment, ensure you have the following tools installed and configured on your system:

1. **Node.js**: Verify installation by running:

   ```bash
   node -v
   ```

2. **Solana CLI**: Verify installation by running:

   ```bash
   solana --version
   ```

3. **Anchor CLI**: Verify installation by running:

   ```bash
   anchor --version
   ```

If any of these tools are missing, visit their official documentation for installation instructions.

---

## 🚀 Steps to Deploy

### 1. Set Up Your Environment

1. **Clone the Project Repository**:
   Start by cloning the repository to your local machine:

   ```bash
   git clone https://github.com/infoparth/token_buy_repo.git
   cd token-buy-repo
   ```

2. **Install Dependencies**:
   Use Yarn (recommended) or npm to install the project dependencies:

   ```bash
   yarn install
   ```

   or

   ```bash
   npm install
   ```

3. **Configure Solana CLI**:
   Set the Solana network to `devnet` (or `mainnet-beta`/`testnet` as needed):

   ```bash
   solana config set --url devnet
   ```

   Ensure your Solana wallet is configured and funded. If you’re using `devnet`, you can airdrop SOL using:

   ```bash
   solana airdrop 2
   ```

---

### 2. Deploy the Program

1. **Build the Program**:
   Compile your Anchor program by running:

   ```bash
   anchor build
   ```

2. **Retrieve the Program Address**:
   After building, fetch the program’s address from the generated keypair:

   ```bash
   solana address -k target/deploy/token_biu-keypair.json
   ```

   The output is your **Program ID**. Save this for the next steps.

3. **Update the Program ID in the Code**:

   - Open your program’s main Rust file (e.g., `lib.rs`).
   - Replace the placeholder in the `declare_id!()` macro with your Program ID:

     ```rust
     declare_id!("YourProgramAddressHere");
     ```

   - Update the `Anchor.toml` file with the same Program ID:

     ```toml
     token_biu = "YourProgramAddressHere"
     ```

4. **Rebuild the Program**:
   Recompile the program with the updated Program ID:

   ```bash
   anchor build
   ```

5. **Deploy the Program**:
   Deploy your program to the Solana blockchain:

   ```bash
   anchor deploy
   ```

   **Note**: If you encounter an "insufficient funds" error, ensure your wallet is funded. For `devnet`, use:

   ```bash
   solana airdrop 2
   ```

6. **Verify Deployment**:
   Confirm your program is live on the blockchain:

   ```bash
   solana program show <program-id>
   ```

---

### 3. Configure the Client

1. **Update the IDL**:
   Anchor automatically generates an IDL (Interface Definition Language) file during the build process. Locate it in the `target/idl/` directory.

2. **Copy the IDL**:
   Replace the existing IDL in your frontend code with the newly generated one. Place it in:

   ```
   constants/token_idl.json
   ```

3. **Update the Token Address**:
   In the `constants/constants.js` file, replace the old `token_buy` address with the new one.

4. **Initialize the Token Sale**:
   Run the `Initialize` component to set up the token sale. Provide the following details:
   - **Recipient Address**: The wallet address that will receive SOL from the sale.
   - **Mint Address**: The token mint address.
   - **Authority**: The wallet signing the transaction will have the authority to pause/resume the sale and update the recipient/authority in the future.

---

## 🔄 Changing the Period for Monthly Limits

The program supports dynamic periods for monthly limits, which can be configured manually in the `constants.rs` file. Here's how:

1. **Open `constants.rs`**:
   Locate the `constants.rs` file in your project:

   ```
   src/constants.rs
   ```

2. **Change the Period**:
   Update the `PERIOD` constant to one of the following:

   - **Hourly**: For hourly periods (1 hour).
   - **Daily**: For daily periods (24 hours).
   - **Monthly**: For monthly periods (~30.44 days).

   Example:

   ```rust
   // Change this line to set the desired period
   pub const PERIOD: Period = Period::Hourly; // or Period::Daily, Period::Monthly
   ```

3. **Rebuild and Redeploy**:
   After changing the period, rebuild and redeploy the program:

   ```bash
   anchor build
   anchor deploy
   ```

4. **Verify the Changes**:
   The program will now use the updated period for all calculations, such as monthly limits and time-based checks.

---

Wallet: A5PUghSrYo9TrKA5LhHCsjwDhFQhbLgFBM1NQL5FNkxJ

Buyer: 4t9D69PtNtuRv4p1C4eF1PeJz6LYwLNzPqUNzvRJ6X7v
