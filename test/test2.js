const {
    time,
    loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("Auction", function() {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshopt in every test.
    // async function deployOneYearLockFixture() {
    //   const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
    //   const ONE_GWEI = 1_000_000_000;

    //   const lockedAmount = ONE_GWEI;
    //   const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;

    //   // Contracts are deployed using the first signer/account by default
    //   const [owner, otherAccount] = await ethers.getSigners();

    //   const Lock = await ethers.getContractFactory("Lock");
    //   const lock = await Lock.deploy(unlockTime, { value: lockedAmount });

    //   return { lock, unlockTime, lockedAmount, owner, otherAccount };
    // }

    async function setup() {
        const [deployer, addr1, addr2] = await ethers.getSigners()

        const nft = await ethers.getContractFactory("NFT", deployer)
        const NFT = await nft.deploy()
        const NFT2 = await nft.deploy()

        const weth = await ethers.getContractFactory("Token", deployer)
        const WETH = await weth.deploy("", "", ethers.utils.parseEther("100"))

        const auction = await ethers.getContractFactory("AuctionV2", deployer)
        const AUCTION = await auction.deploy(
            NFT.address,
            NFT2.address,
            WETH.address
        )

        const ONE_DAY = 60 * 60 * 24

        const depositedAmount = ethers.utils.parseEther("20")


        await WETH.connect(deployer).transfer(addr1.address, depositedAmount)
        await WETH.connect(deployer).transfer(addr2.address, depositedAmount)

        await WETH.connect(addr1).approve(AUCTION.address, depositedAmount)
        await WETH.connect(deployer).approve(AUCTION.address, depositedAmount)
        await WETH.connect(addr2).approve(AUCTION.address, depositedAmount)

        return { ONE_DAY, AUCTION, WETH, NFT, NFT2, deployer, addr1, addr2, depositedAmount }
    }

    describe("Testing", function() {

        // function listItem(address _minter, uint16 tokenId, uint64 time, uint256 _bidStep,uint256 _startingPrice) external onlyAdmin {

        it("Should allow the deployer to list an NFT", async function() {
            const { ONE_DAY, AUCTION, WETH, NFT, NFT2, deployer, addr1, addr2, depositedAmount } = await loadFixture(setup)

            await NFT.connect(deployer).approve(AUCTION.address, 1)

            expect(await AUCTION.connect(deployer).listItem(NFT.address, 1, ONE_DAY, ethers.utils.parseEther("0.01"), ethers.utils.parseEther("0.05")))

            expect(await NFT.ownerOf(1)).to.be.equal(AUCTION.address)
        })

        it("Should allow the deployer to list an NFT from collection 2", async function() {
            const { ONE_DAY, AUCTION, WETH, NFT, NFT2, deployer, addr1, addr2, depositedAmount } = await loadFixture(setup)

            await NFT2.connect(deployer).approve(AUCTION.address, 1)

            expect(await AUCTION.connect(deployer).listItem(NFT2.address, 1, ONE_DAY, ethers.utils.parseEther("0.01"), ethers.utils.parseEther("0.05")))


            expect(await NFT2.ownerOf(1)).to.be.equal(AUCTION.address)
        })

        it("Should not allow anyone other than the deployer to list an NFT", async() => {
            const { ONE_DAY, AUCTION, WETH, NFT, NFT2, deployer, addr1, addr2, depositedAmount } = await loadFixture(setup)

            await NFT.connect(deployer).transferFrom(deployer.address, addr1.address, 1)

            await NFT.connect(addr1).approve(AUCTION.address, 1)

            expect(AUCTION.listItem(NFT.address, 1, ONE_DAY, ethers.utils.parseEther("0.01"), ethers.utils.parseEther("0.05"))).to.be.revertedWith("ERR:NA")
        })

        it("Should not allow a user to place a bid if they don't own a NFT from either collection", async() => {
            const { ONE_DAY, AUCTION, WETH, NFT, NFT2, deployer, addr1, addr2, depositedAmount } = await loadFixture(setup)

            await NFT.connect(deployer).approve(AUCTION.address, 1)

            await AUCTION.connect(deployer).listItem(NFT.address, 1, ONE_DAY, ethers.utils.parseEther("0.01"), ethers.utils.parseEther("0.05"))

            expect(AUCTION.connect(addr1).bidOnItem(0, ethers.utils.parseEther("0.06"))).to.be.revertedWith("ERR:NH")
        })

        it("Should allow a user to place a bid if they own a NFT from collection 1", async() => {
            const { ONE_DAY, AUCTION, WETH, NFT, NFT2, deployer, addr1, addr2, depositedAmount } = await loadFixture(setup)

            await NFT.connect(deployer).approve(AUCTION.address, 1)

            await AUCTION.connect(deployer).listItem(NFT.address, 1, ONE_DAY, ethers.utils.parseEther("0.01"), ethers.utils.parseEther("0.05"))

            await NFT.connect(deployer).transferFrom(deployer.address, addr1.address, 2)

            expect(await AUCTION.connect(addr1).bidOnItem(0, ethers.utils.parseEther("0.06")))
        })

        it("Should allow a user to place a bid if they own a NFT from collection 2", async() => {
            const { ONE_DAY, AUCTION, WETH, NFT, NFT2, deployer, addr1, addr2, depositedAmount } = await loadFixture(setup)

            await NFT.connect(deployer).approve(AUCTION.address, 1)

            await AUCTION.connect(deployer).listItem(NFT.address, 1, ONE_DAY, ethers.utils.parseEther("0.01"), ethers.utils.parseEther("0.05"))

            await NFT2.connect(deployer).transferFrom(deployer.address, addr1.address, 1)

            expect(await AUCTION.connect(addr1).bidOnItem(0, ethers.utils.parseEther("0.06")))
        })

        it("Should not allow a user to place a bid lower than a previous bid", async() => {
            const { ONE_DAY, AUCTION, WETH, NFT, NFT2, deployer, addr1, addr2, depositedAmount } = await loadFixture(setup)

            await NFT.connect(deployer).approve(AUCTION.address, 1)

            await AUCTION.connect(deployer).listItem(NFT.address, 1, ONE_DAY, ethers.utils.parseEther("0.01"), ethers.utils.parseEther("0.05"))

            await NFT2.connect(deployer).transferFrom(deployer.address, addr1.address, 1)
            await NFT2.connect(deployer).transferFrom(deployer.address, addr2.address, 2)

            await AUCTION.connect(addr1).bidOnItem(0, ethers.utils.parseEther("0.06"))

            expect(AUCTION.connect(addr2).bidOnItem(0, ethers.utils.parseEther("0.04"))).to.be.revertedWith("ERR:NE")
        })

        it("Should refund the user their weth if they are outbid", async() => {
            const { ONE_DAY, AUCTION, WETH, NFT, NFT2, deployer, addr1, addr2, depositedAmount } = await loadFixture(setup)

            await NFT.connect(deployer).approve(AUCTION.address, 1)

            await AUCTION.connect(deployer).listItem(NFT.address, 1, ONE_DAY, ethers.utils.parseEther("0.01"), ethers.utils.parseEther("0.05"))

            await NFT2.connect(deployer).transferFrom(deployer.address, addr1.address, 1)
            await NFT2.connect(deployer).transferFrom(deployer.address, addr2.address, 2)

            await AUCTION.connect(addr1).bidOnItem(0, ethers.utils.parseEther("0.06"))

            expect(await AUCTION.connect(addr2).bidOnItem(0, ethers.utils.parseEther("0.07")))

            expect(await WETH.balanceOf(addr1.address)).to.be.equal(ethers.utils.parseEther("20"))
        })

        it("Should allow a user to claim the NFT if they won the auction", async() => {
            const { ONE_DAY, AUCTION, WETH, NFT, NFT2, deployer, addr1, addr2, depositedAmount } = await loadFixture(setup)

            await NFT.connect(deployer).approve(AUCTION.address, 1)

            await AUCTION.connect(deployer).listItem(NFT.address, 1, ONE_DAY, ethers.utils.parseEther("0.01"), ethers.utils.parseEther("0.05"))

            await NFT2.connect(deployer).transferFrom(deployer.address, addr1.address, 1)
            await NFT2.connect(deployer).transferFrom(deployer.address, addr2.address, 2)

            await AUCTION.connect(addr1).bidOnItem(0, ethers.utils.parseEther("0.06"))

            await ethers.provider.send("evm_increaseTime", [ONE_DAY])

            expect(await AUCTION.connect(addr1).claimNFT(0))

            expect(await NFT.ownerOf(1)).to.be.equal(addr1.address)
        })

        it("Should not allow a user who didn't win to claim a NFT", async() => {
            const { ONE_DAY, AUCTION, WETH, NFT, NFT2, deployer, addr1, addr2, depositedAmount } = await loadFixture(setup)

            await NFT.connect(deployer).approve(AUCTION.address, 1)

            await AUCTION.connect(deployer).listItem(NFT.address, 1, ONE_DAY, ethers.utils.parseEther("0.01"), ethers.utils.parseEther("0.05"))

            await NFT2.connect(deployer).transferFrom(deployer.address, addr1.address, 1)
            await NFT2.connect(deployer).transferFrom(deployer.address, addr2.address, 2)

            await AUCTION.connect(addr1).bidOnItem(0, ethers.utils.parseEther("0.06"))

            await ethers.provider.send("evm_increaseTime", [ONE_DAY])

            expect(AUCTION.connect(addr2).claimNFT(0)).to.be.revertedWith("ERR:HB")
        })

        it("Should allow the admin to change the admin", async() => {
            const { ONE_DAY, AUCTION, WETH, NFT, NFT2, deployer, addr1, addr2, depositedAmount } = await loadFixture(setup)

            expect(await AUCTION.connect(deployer).updateAdmin(addr1.address))
        })

        it("Should not allow a wallet other than the admin to change the admin", async() => {
            const { ONE_DAY, AUCTION, WETH, NFT, NFT2, deployer, addr1, addr2, depositedAmount } = await loadFixture(setup)

            expect(AUCTION.connect(addr1).updateAdmin(addr1.address)).to.be.revertedWith("ERR:NA");
        })

        it("Should allow the admin to add a new minter", async() => {
            const { ONE_DAY, AUCTION, WETH, NFT, NFT2, deployer, addr1, addr2, depositedAmount } = await loadFixture(setup)

            expect(await AUCTION.connect(deployer).addNewMinterToHolderCheck(addr2.address))
        })

        it("Should allow the admin to remove a minter", async() => {
            const { ONE_DAY, AUCTION, WETH, NFT, NFT2, deployer, addr1, addr2, depositedAmount } = await loadFixture(setup)

            expect(await AUCTION.connect(deployer).removeMinterFromHolderCheck(NFT.address))
        })

        it("Should not allow anyone other than the admin to add a new minter", async() => {
            const { ONE_DAY, AUCTION, WETH, NFT, NFT2, deployer, addr1, addr2, depositedAmount } = await loadFixture(setup)

            expect(AUCTION.connect(addr1).addNewMinterToHolderCheck(addr2.address)).to.be.revertedWith("ERR:NA")
        })

        it("Should not allow anyone other than the admin to remove a new minter", async() => {
            const { ONE_DAY, AUCTION, WETH, NFT, NFT2, deployer, addr1, addr2, depositedAmount } = await loadFixture(setup)

            expect(AUCTION.connect(addr1).removeMinterFromHolderCheck(NFT.address)).to.be.revertedWith("ERR:NA")
        })
    })
})