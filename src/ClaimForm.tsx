/// <reference path="dns-packet.d.ts" />
import { ethers } from 'ethers';
import React from 'react';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { encode as encodePacket, decode as decodePacket, Packet, RECURSION_DESIRED } from 'dns-packet';
import { abi as nameClaimsABI } from '@ensdomains/ethregistrar/build/contracts/ShortNameClaims.json';

import DNSProofInfo from './DNSProofInfo';
import { ProviderContext } from './ProviderContext';

const NAME_RE = /^([^.]{3,6}\.[^.]+|[^.]{3,6}eth\.[^.]+|[^.]{1,4}\.[^.]{2}|[^.]{1,3}\.[^.]{3}|[^.]{1,2}\.[^.]{4}|[^.]{1}\.[^.]{5})$/;
const DNS_URL = 'https://cloudflare-dns.com/dns-query?ct=application/dns-udpwireformat&dns=';

const styles = (theme: Theme) =>
  createStyles({
    textField: {
      marginLeft: theme.spacing(1),
      marginRight: theme.spacing(1),
      width: '100%',
    },
    button: {
      margin: theme.spacing(1),
      width: "40%",
    },
    progress: {
      margin: theme.spacing(2),
    },
  });

async function dnsQuery(qtype: string, name: string): Promise<Packet> {
  let q = {
    type: 'query',
    id: Date.now() % 65536,
    flags: RECURSION_DESIRED,
    questions: [
      {
        type: qtype,
        class: 'IN',
        name: name,
      },
    ],
    answers: [],
    authorities: [],
    additionals: [],
  };
  return await getDNS(q);
}

async function getDNS(query: Packet): Promise<Packet> {
  let response = await fetch(DNS_URL + encodePacket(query).toString('base64'));
  let decoded = decodePacket(new Buffer(await response.arrayBuffer()));
  return decoded;
}

enum Status {
  Initial = 1,
  Loading,
  Loaded
}

interface State {
  status: Status;
  name: string;
  result?: Packet;
}

interface Props extends WithStyles<typeof styles> {
  address: string;
}

class ClaimForm extends React.Component<Props, State> {
  claimer?: ethers.Contract;

  static contextType = ProviderContext;

  constructor(props: Props) {
    super(props);

    this.state = {
      name: '',
      status: Status.Initial,
    }
  }

  async componentDidMount() {
    this.claimer = new ethers.Contract(this.props.address, nameClaimsABI, this.context.provider);
  }

  handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ name: event.target.value, status: Status.Initial });
  }

  handleCheck = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    return this.doCheck();
  }

  doCheck = async () => {
    if(!this.claimer) return;
    this.setState({ status: Status.Loading });

    const result = await dnsQuery("TXT", "_ens." + this.state.name);

    this.setState({
      status: Status.Loaded,
      result: result,
    });
  }

  handleClear = async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    this.setState({
      status: Status.Initial,
      name: '',
    })
  }

  render() {
    const { classes } = this.props;
    const { name, status, result } = this.state;

    return (
      <Grid container spacing={3}>
        <Grid item xs={9}>
          <TextField
            autoFocus={true}
            label="DNS domain"
            className={classes.textField}
            value={name}
            onKeyPress={(ev) => (ev.key === 'Enter' && this.doCheck())}
            onChange={this.handleChange}
          />
        </Grid>
        <Grid item xs={3}>
          <Button
            variant="contained"
            color="primary"
            className={classes.button}
            onClick={this.handleCheck}
            disabled={!NAME_RE.test(name)}
          >Check</Button>
          <Button
            variant="contained"
            color="default"
            className={classes.button}
            onClick={this.handleClear}
          >Clear</Button>
        </Grid>
        {status === Status.Loading && <Grid item xs={12}><CircularProgress className={classes.progress} /></Grid>}
        {status === Status.Loaded && result && this.claimer && <DNSProofInfo name={name} claimer={this.claimer} result={result} />}
      </Grid>
    );
  }
}

export default withStyles(styles)(ClaimForm);
