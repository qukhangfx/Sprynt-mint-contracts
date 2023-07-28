module.exports = {
    skipFiles: [
        'childs/PolarysNftContract.sol',
        'interfaces/IPolarysNftContract.sol',
        'library/CloneFactory',
        'library/Domain.sol',
        'mocks/TestToken.sol',
        'mocks/TestPriceFeed.sol',
    ],
    configureYulOptimizer: true,
    solcOptimizerDetails: {
        peephole: false,
        inliner: false,
        jumpdestRemover: false,
        orderLiterals: true,
        deduplicate: false,
        cse: false,
        constantOptimizer: true,
        yul: true,
    },
    istanbulReporter: ['html'],
};