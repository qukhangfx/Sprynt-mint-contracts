// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;
import {DepositItem} from "./Structs.sol";

library Domain {
    bytes32 public constant DEPOSIT_ITEM_TYPEHASH =
        keccak256(
            "DepositItem(uint256 mintPrice,uint256 mintQuantity,address sellerAddress,uint16 dstChainId,bool isMintAvailable,uint256 nonce,uint256 deadline)"
        );

    function _hashDepositItem(
        DepositItem memory item,
        uint256 onchainNonce
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    DEPOSIT_ITEM_TYPEHASH,
                    item.mintPrice,
                    item.mintQuantity,
                    item.sellerAddress,
                    // item.dstChainId,
                    // item.isMintAvailable,
                    onchainNonce
                    // item.deadline
                )
            );
    }
}
