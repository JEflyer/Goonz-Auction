//SPDX-License-Identifier: MIT 

//Chose exact solidity version
pragma solidity 0.8.15;

//Import ERC721 interface
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

//Import WETH interface
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

//Import the context library for safe retreival of msg.sender
import "@openzeppelin/contracts/utils/Context.sol";

contract AuctionV2 is Context{

    //List of events
    event NewListing(uint256 saleID, uint16 tokenId, address minter, address lister);
    event NewBid(uint256 saleID, uint256 amount, address bidder);
    event Winner(uint256 saleID, address winner);

    //Stores the address of the admin of this contract
    address private admin;

    // //Stores an instance of the ERC721 minter interfacfe
    // IERC721 private minter;

    // //Stroes the address of the secondary minter
    // IERC721 private minter2;

    IERC721[] private minters;

    //Stores an instance of a WETH interface
    IERC20 private weth;

    //Define a struct containing all the necesary details for a sale   
    struct SaleDetails {
        address highestBidder;
        address minter;
        uint256 highestBid;
        uint256 bidStep;
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
        address _minter2,
        address _weth
    ){
        //Stores the deployer as the admin
        admin = _msgSender();

        //Builds an instance of the WETH interface
        weth = IERC20(_weth);

        //Builds an instance of the ERC721 interface 
        minters.push(IERC721(_minter));
        
        //Builds an instance of the ERC721 interface
        minters.push(IERC721(_minter2));
    }

    modifier onlyAdmin {
        require(_msgSender() == admin,"ERR:NA");//NA => Not Admin
        _;
    }

    function updateAdmin(address _new) external onlyAdmin {
        admin = _new;
    }

    function addNewMinterToHolderCheck(address _new) external onlyAdmin {
        minters.push(IERC721(_new));
    }

    function removeMinterFromHolderCheck(address _remove) external onlyAdmin {
        for(uint8 i = 0; i < minters.length; ){

            if(address(minters[i]) == _remove){
                minters[i] = minters[minters.length-1];
                delete minters[minters.length-1];
                minters.pop();
                break;
            }

            unchecked{
                i++;
            }
        }
    }

    //This function can only be called by the admin of this contract
    function listItem(address _minter, uint16 tokenId, uint64 time, uint256 _bidStep,uint256 _startingPrice) external onlyAdmin {

        //Get the address of the caller
        address caller = _msgSender();

        IERC721 tempMinter = IERC721(_minter);

        //Check that this contract is approved to move this token
        require(tempMinter.getApproved(tokenId) == address(this), "ERR:GA");//GA => Getting Approved

        //Transfer the token from the caller to this contract
        tempMinter.transferFrom(caller,address(this),tokenId);
        
        //Build new sale details
        saleDetails[saleId++] = SaleDetails({
            highestBid: _startingPrice,
            bidStep: _bidStep,
            tokenId: tokenId,
            highestBidder: caller,
            bidUntil: uint64(block.timestamp) + time,
            active: true,
            minter: _minter
        });

        //Emit event
        emit NewListing(saleId,tokenId, _minter, caller);
    
    }

    function checkIfHolder(address caller) internal view returns(bool) {
        for(uint8 i = 0 ; i < minters.length;){

            if(minters[i].balanceOf(caller) > 0){
                return true;
            }

            unchecked{
                i++;
            }
        }
        return false;
    } 

    //Anyone can call this function
    function bidOnItem(uint256 saleID, uint256 amount) external {
        
        //Get the address of the caller
        address caller = _msgSender();

        require(
            checkIfHolder(caller),
            "ERR:NH"
        );//NH => Not Holder

        //Pull struct into the function to avoid excessive SLoad functions
        SaleDetails storage details = saleDetails[saleID];

        //Check that the sale is active
        require(details.active,"ERR:NA");//NA => Not Active

        //Check that the auction can still be bid on
        require(uint64(block.timestamp) < details.bidUntil,"ERR:BO");//BO => Bidding Over

        //Check that the amount the user is going to pay is greater than the current bid
        require(amount == details.highestBid + details.bidStep, "ERR:NE");//NE => Not Exact

        //Get the amount that the caller has approved this contract to spend
        uint256 amountApproved = weth.allowance(caller,address(this));

        //Check that the amount approved is greater than or equal to the amount bid
        require(amountApproved >= amount, "ERR:AA");//AA => Amount Approved

        //Transfer the WETH from the caller to this contract
        weth.transferFrom(caller,address(this),amount);

        if(details.highestBidder != admin){
            //Transfer the old highest bid back to the old highest bidder
            weth.transfer(details.highestBidder, details.highestBid);
        }
        
        //Set the new highest bidder & bid amount
        details.highestBidder = caller;
        details.highestBid = amount;

        //Emit event
        emit NewBid(saleID, amount, caller);
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
        IERC721(details.minter).transferFrom(address(this), caller, details.tokenId);

        //If the admin isn't reclaiming an NFT that has not been bid on
        if(details.highestBidder != admin){
            //Transfer the highest bid to the admin
            weth.transfer(admin, details.highestBid);
        }

        //Delete the active bool setting it to false & refunding gas
        delete details.active;

        //Emit event
        emit Winner(saleID, caller);
    }

    function getNextBid(uint256 saleID) external view returns(uint256){
        //Pull struct into the function to avoid excessive SLoad functions
        SaleDetails storage details = saleDetails[saleID];

        return details.highestBid + details.bidStep;
    }
}