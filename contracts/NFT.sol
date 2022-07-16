//SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

//Import ERC721Enumerable extension
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract NFT is ERC721Enumerable {

    constructor()ERC721("",""){
        _mint(msg.sender,1);
        _mint(msg.sender,2);
    }
}