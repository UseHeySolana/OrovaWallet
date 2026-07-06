import { Connection, ParsedAccountData, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createTransferInstruction, getAccount, TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, TokenAccountNotFoundError } from "@solana/spl-token";
import { keypairSign, signTransactions } from "@/utils/functions/extrafunctions";
import {
    estimateSolTransferFeeLamports,
    solToLamports,
} from "@/utils/wallet/solTransferFees";



export const transferSol = async (
    toAddress: string,
    amount: number,
    connection: Connection
) => {
    try {
        let fromWallet = await keypairSign();
        if (!fromWallet) throw Error;

        const toPubkey = new PublicKey(toAddress);
        const lamports = solToLamports(amount);
        if (lamports <= 0) {
            return { status: false, message: "Invalid transfer amount" };
        }

        const balanceLamports = await connection.getBalance(fromWallet.publicKey);
        const feeLamports = await estimateSolTransferFeeLamports(
            connection,
            fromWallet.publicKey,
            toPubkey,
            lamports
        );
        if (balanceLamports < lamports + feeLamports) {
            return { status: false, message: "Insufficient funds for Fees" };
        }

        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: fromWallet.publicKey,
                toPubkey,
                lamports,
            })
        );

        // Set the fee payer
        transaction.feePayer = fromWallet.publicKey;

        // Get a recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;

        // Serialize the transaction to base64
        const serialized = transaction.serialize({ requireAllSignatures: false }).toString("base64");

        // Use the external signTransactions function
        const txid = await signTransactions({tx: serialized});
        console.log(`Transaction submitted with signature: ${txid}`);

        return txid;

    } catch (error) {
        console.error("Error transferring SOL:", error);
        throw error;
    }


};


async function getNumberDecimals(mintAddress: string, connection: Connection): Promise<number> {
    const info = await connection.getParsedAccountInfo(new PublicKey(mintAddress));
    const result = (info.value?.data as ParsedAccountData).parsed.info.decimals as number;
    return result;
}

export const transferToken = async (
    toAddress: string,
    tokenMintAddress: string,
    amount: number,
    decimals: number,
    connection: Connection
) => {
    let fromWallet = await keypairSign();

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

        // console.log(fromTokenAccount, toTokenAccount)

        const numberDecimals = await getNumberDecimals(tokenMintAddress, connection);

        const tokenAmount = amount * Math.pow(10, numberDecimals);
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

        // Serialize the transaction to base64
        const serialized = transaction.serialize({ requireAllSignatures: false }).toString("base64");

        // Use the external signTransactions function
        const txid = await signTransactions({tx: serialized});
        console.log(`Transaction submitted with signature: ${txid}`);

        return txid;

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
        if (
            error instanceof TokenAccountNotFoundError ||
            error?.name === "TokenAccountNotFoundError"
        ) {
            console.log("Token account not found. The wallet does not hold this token.");
            return 0;
        }
        console.error("Error fetching token balance:", error);
        throw error;
    }
};