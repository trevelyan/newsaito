FROM node:10-jessie

RUN apt-get update
RUN apt-get install g++ make git

COPY ./ /newsaito

RUN git clone https://github.com/sparsehash/sparsehash

WORKDIR /sparsehash

RUN ./configure && make && make install

WORKDIR /newsaito

RUN npm install

RUN cd ./lib && ./compile nuke

CMD node ./lib/start.js
# ENTRYPOINT /bin/sh

EXPOSE 12101

