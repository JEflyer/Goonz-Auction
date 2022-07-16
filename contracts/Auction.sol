//SPDX-License-Identifier: MIT 

//Chose exact solidity version
pragma solidity 0.8.15;

//Import ERC721 interface
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

//Import WETH interface
import "./WETH.sol";

//Import the context library for safe retreival of msg.sender
import "@openzeppelin/contracts/utils/Context.sol";

contract Auction is Context{

    //List of events
    event NewListing(uint256 saleID, uint16 tokenId, address lister);
    event NewBid(uint256 saleID, uint256 amount, address bidder);
    event Winner(uint256 saleID, address winner);

    //Stores the address of the admin of this contract
    address private admin;

    //Stores an instance of the ERC721 minter interfacfe
    IERC721 private minter;

    //Stores an instance of a WETH interface
    IWETH private weth;

    //Define a struct containing all the necesary details for a sale   
    struct SaleDetails {
        address highestBidder;
        uint256 highestBid;
        uint64 bidUntil;
        uint16 tokenId;
        bool active;
    }

    //SaleID => Details
    mapping(uint256 => SaleDetails) private saleDetails;

    //Stores the latest saleId
    uint256 private saleId;

    constructor(
        address _minter,
        address _weth
    ){
        //Stores the deployer as the admin
        admin = _msgSender();

        //Builds an instance of the WETH interface
        weth = IWETH(_weth);

        //Builds an instance of the ERC721 interface
        minter = IERC721(_minter);
    }

    //This function can only be called by the admin of this contract
    function listItem(uint16 tokenId, uint64 time) external {

        //Get the address of the caller
        address caller = _msgSender();

        //Check that the caller is the admin of this contract
        require(caller == admin, "ERR:NA");//NA => Not Admin

        //Check that this contract is approved to move this token
        require(minter.getApproved(tokenId) == address(this), "ERR:GA");//GA => Getting Approved

        //Transfer the token from the caller to this contract
        minter.transferFrom(caller,address(this),tokenId);
        
        //Build new sale details
        saleDetails[saleId++] = SaleDetails({
            highestBid: 0,
            tokenId: tokenId,
            highestBidder: caller,
            bidUntil: uint64(block.timestamp) + time,
            active: true
        });

        //Emit event
    }

    //Anyone can call this function
    function bidOnItem(uint256 saleID, uint256 amount) external {
        
        //Get the address of the caller
        address caller = _msgSender();

        //Pull struct into the function to avoid excessive SLoad functions
        SaleDetails storage details = saleDetails[saleID];

        //Check that the sale is active
        require(details.active,"ERR:NA");//NA => Not Active

        //Check that the auction can still be bid on
        require(uint64(block.timestamp) < details.bidUntil,"ERR:BO");//BO => Bidding Over

        //Check that the amount the user is going to pay is greater than the current bid
        require(amount > details.highestBid, "ERR:NE");//NE => Not Enough

        //Get the amount that the caller has approved this contract to spend
        uint256 amountApproved = weth.allowance(caller,address(this));

        //Check that the amount approved is greater than or equal to the amount bid
        require(amountApproved >= amount, "ERR:AA");//AA => Amount Approved

        //Transfer the WETH from the caller to this contract
        weth.transferFrom(caller,address(this),amount);

        //Transfer the old highest bid back to the old highest bidder
        weth.transferFrom(address(this), details.highestBidder, details.highestBid);

        //Set the new highest bidder & bid amount
        details.highestBidder = caller;
        details.highestBid = amount;

        //Emit event
    }

    //This function can only be called by the winner of the auction
    function claimNFT(uint256 saleID) external {

        //Get the address of the caller
        address caller = _msgSender();

        //Pull struct into the function to avoid excessive SLoad functions
        SaleDetails storage details = saleDetails[saleID];

        //Check that the sale has not been claimed yet
        require(details.active,"ERR:NA");//NA => Not Active

        //Check that the sale is over
        require(uint64(block.timestamp) >= details.bidUntil,"ERR:NO");//NO => Not Over

        //Check that the caller did win the auction
        require(caller == details.highestBidder, "ERR:HB");//HB => Highest Bidder

        //Transfer the NFT from this contract to the caller
        minter.transferFrom(address(this), caller, details.tokenId);

        //Transfer the highest bid to the admin
        weth.transferFrom(address(this), admin, details.highestBid);

        //Delete the active bool setting it to false & refunding gas
        delete details.active;
    }
}