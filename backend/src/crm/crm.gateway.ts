import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthUser } from '../users/user.types';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/crm',
})
export class CrmGateway implements OnGatewayConnection {
  private readonly log = new Logger(CrmGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  @WebSocketServer()
  server!: Server;

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.query?.token as string | undefined) ??
        this.extractBearer(client.handshake.headers.authorization) ??
        this.extractCookieToken(client.handshake.headers.cookie);
      if (!token) {
        throw new UnauthorizedException('Missing token');
      }
      const secret = this.config.getOrThrow<string>('JWT_SECRET');
      const payload = await this.jwt.verifyAsync<AuthUser>(token, { secret });
      (client.data as Record<string, unknown>).user = payload;
      client.join(`user:${payload.id}`);
    } catch (err) {
      this.log.warn(`Rejecting socket: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  private extractBearer(header?: string): string | undefined {
    if (!header) return undefined;
    const [type, token] = header.split(' ');
    if (type?.toLowerCase() === 'bearer') return token;
    return undefined;
  }

  private extractCookieToken(cookieHeader?: string): string | undefined {
    if (!cookieHeader) return undefined;
    const tokenPair = cookieHeader
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith('crm_at='));
    if (!tokenPair) return undefined;
    return decodeURIComponent(tokenPair.slice('crm_at='.length));
  }

  broadcast(event: string, payload: unknown) {
    if (!this.server) {
      this.log.warn('WebSocket server not ready');
      return;
    }
    this.server.emit(event, payload);
  }

  notifyUser(userId: string, event: string, payload: unknown) {
    if (!this.server) {
      this.log.warn('WebSocket server not ready');
      return;
    }
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
