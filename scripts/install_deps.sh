#!/bin/bash

if [ -x "$(command -v docker)" ]; then
    echo "Docker already installed"
else
    echo "Install docker"
    curl -fsSL https://get.docker.com -o get-docker.sh
    bash get-docker.sh
    sudo usermod -aG docker $USER
fi

if [[ "$OSTYPE" == "linux-gnu" ]]; then
    sudo apt-get -qq update -y
    sudo apt-get -qq install -y apt-utils
    sudo apt-get -qq install -y docker-compose git make jq nodejs openssl
    sudo apt-get -qq install -y npm || echo "NPM already installed with nodejs"
    curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
    if ! [ -x "$(command -v yarn)" ]; then
        echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
        sudo apt-get update -y && sudo apt-get install -y --no-install-recommends yarn
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
    brew install caskroom/cask/brew-cask
    brew cask install docker-toolbox
    brew install jq
    brew install homebrew/core/make
    brew install git
    brew install node
    brew install yarn
    brew install openssl
fi

yarn