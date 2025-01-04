/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/token_biu.json`.
 */
export type TokenBiu = {
  address: "AFqeVXgZX3KWf2c2eUJM2YVEKFH2nR7PCLiCSAqsSrPp";
  metadata: {
    name: "tokenBiu";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "buyTokens";
      discriminator: [189, 21, 230, 133, 247, 2, 110, 42];
      accounts: [
        {
          name: "buyer";
          writable: true;
          signer: true;
        },
        {
          name: "saleAuthority";
          writable: true;
        },
        {
          name: "programSaleAuthority";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              }
            ];
          };
        },
        {
          name: "saleConfig";
        },
        {
          name: "authority";
        },
        {
          name: "mint";
        },
        {
          name: "programTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "programSaleAuthority";
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ];
              },
              {
                kind: "account";
                path: "mint";
              }
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ];
            };
          };
        },
        {
          name: "buyerTokenAccount";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "account";
                path: "buyer";
              },
              {
                kind: "const";
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ];
              },
              {
                kind: "account";
                path: "mint";
              }
            ];
            program: {
              kind: "const";
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ];
            };
          };
        },
        {
          name: "priceUpdate";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        }
      ];
      args: [
        {
          name: "solAmount";
          type: "u64";
        }
      ];
    },
    {
      name: "initializeSale";
      discriminator: [208, 103, 34, 154, 179, 6, 125, 208];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "saleConfig";
          writable: true;
          signer: true;
        },
        {
          name: "recipient";
          writable: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [
        {
          name: "tokenPriceUsd";
          type: "f64";
        },
        {
          name: "mintDecimals";
          type: "u64";
        }
      ];
    },
    {
      name: "pauseSale";
      discriminator: [120, 107, 163, 108, 19, 201, 121, 223];
      accounts: [
        {
          name: "saleConfig";
          writable: true;
        },
        {
          name: "authority";
          signer: true;
          relations: ["saleConfig"];
        }
      ];
      args: [];
    },
    {
      name: "resumeSale";
      discriminator: [222, 242, 38, 239, 148, 224, 167, 188];
      accounts: [
        {
          name: "saleConfig";
          writable: true;
        },
        {
          name: "authority";
          signer: true;
          relations: ["saleConfig"];
        }
      ];
      args: [];
    },
    {
      name: "withdrawSol";
      discriminator: [145, 131, 74, 136, 65, 137, 42, 38];
      accounts: [
        {
          name: "saleConfig";
          writable: true;
        },
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "saleAuthority";
          writable: true;
        },
        {
          name: "recipient";
          writable: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        }
      ];
    }
  ];
  accounts: [
    {
      name: "priceUpdateV2";
      discriminator: [34, 241, 35, 99, 157, 126, 244, 205];
    },
    {
      name: "saleConfig";
      discriminator: [86, 47, 71, 156, 87, 152, 149, 246];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "salePaused";
      msg: "Token sale is currently paused";
    },
    {
      code: 6001;
      name: "unauthorized";
      msg: "Unauthorized to perform this action";
    },
    {
      code: 6002;
      name: "insufficientFunds";
      msg: "Insufficient funds for withdrawal";
    },
    {
      code: 6003;
      name: "invalidPythFeedId";
      msg: "Invalid Pyth feed ID";
    },
    {
      code: 6004;
      name: "insufficientTokens";
      msg: "Insufficient tokens in program account";
    },
    {
      code: 6005;
      name: "wrongProgramAuthority";
      msg: "Wrong Program authority";
    },
    {
      code: 6006;
      name: "wrongRecipientAddress";
      msg: "Wrong Recipient Address for SOL Transfer";
    }
  ];
  types: [
    {
      name: "priceFeedMessage";
      repr: {
        kind: "c";
      };
      type: {
        kind: "struct";
        fields: [
          {
            name: "feedId";
            docs: [
              "`FeedId` but avoid the type alias because of compatibility issues with Anchor's `idl-build` feature."
            ];
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "price";
            type: "i64";
          },
          {
            name: "conf";
            type: "u64";
          },
          {
            name: "exponent";
            type: "i32";
          },
          {
            name: "publishTime";
            docs: ["The timestamp of this price update in seconds"];
            type: "i64";
          },
          {
            name: "prevPublishTime";
            docs: [
              "The timestamp of the previous price update. This field is intended to allow users to",
              "identify the single unique price update for any moment in time:",
              "for any time t, the unique update is the one such that prev_publish_time < t <= publish_time.",
              "",
              "Note that there may not be such an update while we are migrating to the new message-sending logic,",
              "as some price updates on pythnet may not be sent to other chains (because the message-sending",
              "logic may not have triggered). We can solve this problem by making the message-sending mandatory",
              "(which we can do once publishers have migrated over).",
              "",
              "Additionally, this field may be equal to publish_time if the message is sent on a slot where",
              "where the aggregation was unsuccesful. This problem will go away once all publishers have",
              "migrated over to a recent version of pyth-agent."
            ];
            type: "i64";
          },
          {
            name: "emaPrice";
            type: "i64";
          },
          {
            name: "emaConf";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "priceUpdateV2";
      docs: [
        "A price update account. This account is used by the Pyth Receiver program to store a verified price update from a Pyth price feed.",
        "It contains:",
        "- `write_authority`: The write authority for this account. This authority can close this account to reclaim rent or update the account to contain a different price update.",
        "- `verification_level`: The [`VerificationLevel`] of this price update. This represents how many Wormhole guardian signatures have been verified for this price update.",
        "- `price_message`: The actual price update.",
        "- `posted_slot`: The slot at which this price update was posted."
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "writeAuthority";
            type: "pubkey";
          },
          {
            name: "verificationLevel";
            type: {
              defined: {
                name: "verificationLevel";
              };
            };
          },
          {
            name: "priceMessage";
            type: {
              defined: {
                name: "priceFeedMessage";
              };
            };
          },
          {
            name: "postedSlot";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "saleConfig";
      type: {
        kind: "struct";
        fields: [
          {
            name: "authority";
            type: "pubkey";
          },
          {
            name: "tokenPriceUsd";
            type: "f64";
          },
          {
            name: "paused";
            type: "bool";
          },
          {
            name: "mintDecimals";
            type: "u64";
          },
          {
            name: "saleAuthority";
            type: "pubkey";
          },
          {
            name: "recipient";
            type: "pubkey";
          }
        ];
      };
    },
    {
      name: "verificationLevel";
      docs: [
        "Pyth price updates are bridged to all blockchains via Wormhole.",
        "Using the price updates on another chain requires verifying the signatures of the Wormhole guardians.",
        "The usual process is to check the signatures for two thirds of the total number of guardians, but this can be cumbersome on Solana because of the transaction size limits,",
        "so we also allow for partial verification.",
        "",
        "This enum represents how much a price update has been verified:",
        "- If `Full`, we have verified the signatures for two thirds of the current guardians.",
        "- If `Partial`, only `num_signatures` guardian signatures have been checked.",
        "",
        "# Warning",
        "Using partially verified price updates is dangerous, as it lowers the threshold of guardians that need to collude to produce a malicious price update."
      ];
      type: {
        kind: "enum";
        variants: [
          {
            name: "partial";
            fields: [
              {
                name: "numSignatures";
                type: "u8";
              }
            ];
          },
          {
            name: "full";
          }
        ];
      };
    }
  ];
  constants: [
    {
      name: "solUsdFeedId";
      type: "string";
      value: '"0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"';
    }
  ];
};
