import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ClassifierGatewayService {
  private readonly logger = new Logger(ClassifierGatewayService.name);
  private readonly classifierUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.classifierUrl = this.configService.get<string>('CLASSIFIER_SERVICE_URL') || 'http://localhost:3003';
  }

  async clasificar(payload: any): Promise<any> {
    const url = `${this.classifierUrl}/api/clasificar`;
    this.logger.log(`Llamando a Random Forest: ${url}`);

    const response = await this.httpService.axiosRef.post(url, payload, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.logger.log(`Random Forest respondió: nivel ${response.data.nivel_sugerido}`);
    return response.data;
  }
}
