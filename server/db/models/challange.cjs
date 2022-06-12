'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Challange extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Challange.init({
    address: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    challangeCode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    issuedAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    expiresIn: {
      type: DataTypes.DATE,
      allowNull: false,
    }
  }, {
    sequelize,
    modelName: 'Challange',
  });
  return Challange;
};