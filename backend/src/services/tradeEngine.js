const Position = require('../models/Position');

/**
 * Calculates the derived value of an asset based on the underlying stock price.
 */
const getAssetPrice = (assetType, stockPrice, optionType, strikePrice) => {
  if (assetType === 'STOCK') return stockPrice;
  if (assetType === 'FUTURE') return stockPrice + 1.50; // Slight premium for future
  if (assetType === 'OPTION') {
    const strike = parseFloat(strikePrice);
    if (isNaN(strike)) return 0.05;
    if (optionType === 'CALL') {
      return Math.max(0.05, stockPrice - strike) + 2.00;
    } else if (optionType === 'PUT') {
      return Math.max(0.05, strike - stockPrice) + 2.00;
    }
  }
  return stockPrice;
};

/**
 * Processes cash adjustments, portfolio holdings, and updates active position metrics.
 */
const executeTrade = async (user, symbol, type, assetType, optionType, strikePrice, expiry, shares, executionPrice) => {
  const parsedShares = parseFloat(shares);
  const totalPrice = parsedShares * executionPrice;
  const uppercaseSymbol = symbol.toUpperCase();

  if (type === 'BUY') {
    // Deduct cash balance
    user.balance -= totalPrice;

    // Build Position Query
    const query = {
      user: user._id,
      symbol: uppercaseSymbol,
      assetType,
      optionType: assetType === 'OPTION' ? optionType : null,
      strikePrice: assetType === 'OPTION' ? parseFloat(strikePrice) : null,
      expiry: ['OPTION', 'FUTURE'].includes(assetType) ? expiry : null
    };

    // Find and update or create Position
    let position = await Position.findOne(query);
    if (position) {
      const currentQty = position.quantity;
      const newQty = currentQty + parsedShares;
      
      if (Math.abs(newQty) < 0.0001) {
        await position.deleteOne();
      } else {
        if (currentQty > 0) {
          // Adding to long position: recalculate average price
          const oldCost = currentQty * position.avgPrice;
          const newCost = oldCost + (parsedShares * executionPrice);
          position.avgPrice = newCost / newQty;
        } else if (newQty > 0) {
          // Reversing short to long: average price is new execution price
          position.avgPrice = executionPrice;
        } // if covering short (newQty <= 0), avgPrice of original short stays unchanged
        position.quantity = newQty;
        await position.save();
      }
    } else {
      await Position.create({
        ...query,
        quantity: parsedShares,
        avgPrice: executionPrice
      });
    }
  } else if (type === 'SELL') {
    // Add cash balance
    user.balance += totalPrice;

    if (assetType === 'STOCK') {
      // Check settled holdings first
      const holdingIndex = user.portfolio.findIndex(item => item.symbol === uppercaseSymbol);
      if (holdingIndex > -1) {
        const settledShares = user.portfolio[holdingIndex].shares;
        if (settledShares >= parsedShares) {
          // Purely reducing settled holdings
          user.portfolio[holdingIndex].shares -= parsedShares;
          if (user.portfolio[holdingIndex].shares <= 0.0001) {
            user.portfolio.splice(holdingIndex, 1);
          }
        } else {
          // Deduct settled holdings and short-sell the rest
          const remainingToShort = parsedShares - settledShares;
          user.portfolio.splice(holdingIndex, 1);

          const query = {
            user: user._id,
            symbol: uppercaseSymbol,
            assetType: 'STOCK',
            optionType: null,
            strikePrice: null,
            expiry: null
          };

          let position = await Position.findOne(query);
          if (position) {
            const currentQty = position.quantity;
            const newQty = currentQty - remainingToShort;
            if (Math.abs(newQty) < 0.0001) {
              await position.deleteOne();
            } else {
              if (currentQty < 0) {
                // Accumulating short position
                const currentQtyVal = Math.abs(currentQty);
                const oldCost = currentQtyVal * position.avgPrice;
                const newCost = oldCost + (remainingToShort * executionPrice);
                position.avgPrice = newCost / (currentQtyVal + remainingToShort);
              } else if (newQty < 0) {
                // Reversing long to short
                position.avgPrice = executionPrice;
              }
              position.quantity = newQty;
              await position.save();
            }
          } else {
            await Position.create({
              ...query,
              quantity: -remainingToShort,
              avgPrice: executionPrice
            });
          }
        }
      } else {
        // Purely short sell position from scratch
        const query = {
          user: user._id,
          symbol: uppercaseSymbol,
          assetType: 'STOCK',
          optionType: null,
          strikePrice: null,
          expiry: null
        };

        let position = await Position.findOne(query);
        if (position) {
          const currentQty = position.quantity;
          const newQty = currentQty - parsedShares;
          if (Math.abs(newQty) < 0.0001) {
            await position.deleteOne();
          } else {
            if (currentQty < 0) {
              const currentQtyVal = Math.abs(currentQty);
              const oldCost = currentQtyVal * position.avgPrice;
              const newCost = oldCost + (parsedShares * executionPrice);
              position.avgPrice = newCost / (currentQtyVal + parsedShares);
            } else if (newQty < 0) {
              position.avgPrice = executionPrice;
            }
            position.quantity = newQty;
            await position.save();
          }
        } else {
          await Position.create({
            ...query,
            quantity: -parsedShares,
            avgPrice: executionPrice
          });
        }
      }
    } else {
      // Future or Option sell: creates/updates a short position
      const query = {
        user: user._id,
        symbol: uppercaseSymbol,
        assetType,
        optionType: assetType === 'OPTION' ? optionType : null,
        strikePrice: assetType === 'OPTION' ? parseFloat(strikePrice) : null,
        expiry: ['OPTION', 'FUTURE'].includes(assetType) ? expiry : null
      };

      let position = await Position.findOne(query);
      if (position) {
        const currentQty = position.quantity;
        const newQty = currentQty - parsedShares;
        if (Math.abs(newQty) < 0.0001) {
          await position.deleteOne();
        } else {
          if (currentQty < 0) {
            const currentQtyVal = Math.abs(currentQty);
            const oldCost = currentQtyVal * position.avgPrice;
            const newCost = oldCost + (parsedShares * executionPrice);
            position.avgPrice = newCost / (currentQtyVal + parsedShares);
          } else if (newQty < 0) {
            position.avgPrice = executionPrice;
          }
          position.quantity = newQty;
          await position.save();
        }
      } else {
        await Position.create({
          ...query,
          quantity: -parsedShares,
          avgPrice: executionPrice
        });
      }
    }
  }

  await user.save();
};

module.exports = {
  getAssetPrice,
  executeTrade
};
