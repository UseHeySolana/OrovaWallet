import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createTransferInstruction, getAccount, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { NETWORK } from "../global_types";
import { getKeyPair } from "./wallet";



export const transferSol = async (
    toAddress: string,
    amount: number,
    connection: Connection
) => {
    try {
        let fromWallet = await getKeyPair();
        if (!fromWallet) throw Error;
        // Create the transaction
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: fromWallet.publicKey,
                toPubkey: new PublicKey(toAddress),
                lamports: amount * 10 ** 9, // Convert SOL to lamports
            })
        );

        // Set the fee payer
        transaction.feePayer = fromWallet.publicKey;

        // Get a recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;

        // Sign the transaction
        transaction.sign(fromWallet);

        // Send and confirm the transaction
        const signature = await sendAndConfirmTransaction(connection, transaction, [fromWallet]);

        console.log(`Transaction successful with signature: ${signature}`);
        return signature;
    } catch (error) {
        console.error("Error transferring SOL:", error);
        throw error;
    }


};

export const transferToken = async (
    toAddress: string,
    tokenMintAddress: string,
    amount: number,
    decimals: number,
    connection: Connection
) => {
    let fromWallet = await getKeyPair();
    if (!fromWallet) throw Error;
    try {

        // Derive the sender's associated token account

        const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            fromWallet,
            new PublicKey(tokenMintAddress), // Token mint address
            fromWallet.publicKey,          // Owner of the sender's token account
        );

        // Derive the recipient's associated token account
        const toTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            fromWallet,
            new PublicKey(tokenMintAddress),
            new PublicKey(toAddress)
        );

        const tokenAmount = amount * Math.pow(10, decimals);
        // Create the transfer instruction
        const transferInstruction = createTransferInstruction(
            fromTokenAccount.address,         // Source token account
            toTokenAccount.address,           // Destination token account
            fromWallet.publicKey,     // Owner of the source token account
            tokenAmount,   // Amount to transfer (in smallest unit of the token)
            [],
            TOKEN_PROGRAM_ID,
        );

        // Create and sign the transaction
        const transaction = new Transaction().add(transferInstruction);
        transaction.feePayer = fromWallet.publicKey;

        // Get a recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromWallet.publicKey;
        // Sign the transaction
        transaction.sign(fromWallet);

        // Send and confirm the transaction
        try {
        const signature = await sendAndConfirmTransaction(connection, transaction, [fromWallet]);
        console.log(`Token transfer successful with signature: ${signature}`);
        return signature;
        } catch (e) {
            console.log(e)
        }
    } catch (error) {
        console.error("Error transferring token:", error);
        throw error;
    }
};




export const getTokenBalance = async (
    walletAddress: string,
    tokenMintAddress: string,
    decimals: number,
    connection: Connection,
): Promise<number> => {
    try {
        // Derive the associated token account address
        const tokenAccountAddress = await getAssociatedTokenAddress(
            new PublicKey(tokenMintAddress),
            new PublicKey(walletAddress)
        );

        // Fetch the account information
        const tokenAccount = await getAccount(connection, tokenAccountAddress);

        // Retrieve the token balance in the smallest unit (lamports for tokens)
        const rawBalance = Number(tokenAccount.amount);

        // Convert to a human-readable format
        const balance = rawBalance / 10 ** decimals;

        console.log(`Token Balance: ${balance}`);
        return balance;
    } catch (error: any) {
        if (error.message.includes("TokenAccountNotFoundError")) {
            console.error("Token account not found. The wallet does not hold this token.");
            return 0;
        }
        console.error("Error fetching token balance:", error);
        throw error;
    }
};