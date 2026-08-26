/**
 * A trimmed slice of a real answer from their observed-data endpoint: four
 * series, newest reading first, exactly as the live service orders them.
 *
 * It backs MockWiskiController, which exists because apisaih.saihchtajo.es
 * resolves only inside their network — without a local stand-in the client
 * could not be exercised over real HTTP at all.
 */

import { WiskiObservedRecord } from '@infrastructure/services/wiski-json.mapper';

export const MOCK_WISKI_OBSERVED_FIXTURE: WiskiObservedRecord[] = [
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T11:30:00',
        value: 20.356007855624835,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T11:15:00',
        value: 20.356007855624835,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T11:00:00',
        value: 20.356007855624835,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T10:45:00',
        value: 20.356007855624835,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T10:30:00',
        value: 20.356007855624835,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T10:15:00',
        value: 20.356007855624835,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T10:00:00',
        value: 20.356007855624835,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T09:45:00',
        value: 20.358126641731467,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T09:30:00',
        value: 20.358126641731467,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T09:15:00',
        value: 20.360245543533093,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T09:00:00',
        value: 20.360245543533093,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T08:45:00',
        value: 20.360245543533093,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T08:30:00',
        value: 20.360245543533093,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T08:15:00',
        value: 20.360245543533093,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T08:00:00',
        value: 20.360245543533093,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T07:45:00',
        value: 20.360245543533093,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T07:30:00',
        value: 20.362364561069676,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T07:15:00',
        value: 20.362364561069676,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T07:00:00',
        value: 20.362364561069676,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T06:45:00',
        value: 20.362364561069676,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T06:30:00',
        value: 20.362364561069676,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T06:15:00',
        value: 20.362364561069676,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T06:00:00',
        value: 20.362364561069676,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T05:45:00',
        value: 20.362364561069676,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T05:30:00',
        value: 20.362364561069676,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T05:15:00',
        value: 20.364483694380908,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T05:00:00',
        value: 20.364483694380908,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T04:45:00',
        value: 20.364483694380908,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T04:30:00',
        value: 20.364483694380908,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T04:15:00',
        value: 20.364483694380908,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T04:00:00',
        value: 20.36660294350675,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T03:45:00',
        value: 20.364483694380908,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T03:30:00',
        value: 20.364483694380908,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T03:15:00',
        value: 20.364483694380908,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T03:00:00',
        value: 20.364483694380908,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T02:45:00',
        value: 20.36660294350675,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T02:30:00',
        value: 20.36660294350675,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T02:15:00',
        value: 20.36660294350675,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T02:00:00',
        value: 20.368722308486422,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T01:45:00',
        value: 20.368722308486422,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T01:30:00',
        value: 20.368722308486422,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T01:15:00',
        value: 20.368722308486422,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T01:00:00',
        value: 20.368722308486422,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T00:45:00',
        value: 20.37084178935987,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T00:30:00',
        value: 20.372961386166804,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T00:15:00',
        value: 20.37084178935987,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-21T00:00:00',
        value: 20.372961386166804,
    },
    {
        variable: 'E_08VICT01.Validado',
        lastchange: '2026-08-20T23:45:00',
        value: 20.37084178935987,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T11:30:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T11:15:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T11:00:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T10:45:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T10:30:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T10:15:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T10:00:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T09:45:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T09:30:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T09:15:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T09:00:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T08:45:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T08:30:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T08:15:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T08:00:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T07:45:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T07:30:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T07:15:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T07:00:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T06:45:00',
        value: 0.921,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T06:30:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T06:15:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T06:00:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T05:45:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T05:30:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T05:15:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T05:00:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T04:45:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T04:30:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T04:15:00',
        value: 1.532,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T04:00:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T03:45:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T03:30:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T03:15:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T03:00:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T02:45:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T02:30:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T02:15:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T02:00:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T01:45:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T01:30:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T01:15:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T01:00:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T00:45:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T00:30:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T00:15:00',
        value: 0.347,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-21T00:00:00',
        value: 0.0,
    },
    {
        variable: 'E_08FICT99.Validado',
        lastchange: '2026-08-20T23:45:00',
        value: 0.0,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T11:30:00',
        value: 0.8531639391510242,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T11:15:00',
        value: 0.8670764012013276,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T11:00:00',
        value: 0.8670764012013276,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T10:45:00',
        value: 0.8670764012013276,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T10:30:00',
        value: 0.8670764012013276,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T10:15:00',
        value: 0.8879223817491125,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T10:00:00',
        value: 0.8879223817491125,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T09:45:00',
        value: 0.8879223817491125,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T09:30:00',
        value: 0.9016708850364645,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T09:15:00',
        value: 0.9016708850364645,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T09:00:00',
        value: 0.9016708850364645,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T08:45:00',
        value: 0.9153050150694444,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T08:30:00',
        value: 0.9153050150694444,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T08:15:00',
        value: 0.928841540280202,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T08:00:00',
        value: 0.928841540280202,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T07:45:00',
        value: 0.928841540280202,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T07:30:00',
        value: 0.949,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T07:15:00',
        value: 0.949,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T07:00:00',
        value: 0.9623690117942285,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T06:45:00',
        value: 0.9623690117942285,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T06:30:00',
        value: 0.9623690117942285,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T06:15:00',
        value: 0.9757179287689766,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T06:00:00',
        value: 0.9757179287689766,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T05:45:00',
        value: 0.9757179287689766,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T05:30:00',
        value: 0.9890823398466103,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T05:15:00',
        value: 0.9890823398466103,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T05:00:00',
        value: 0.9890823398466103,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T04:45:00',
        value: 1.0092358586736478,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T04:30:00',
        value: 1.0092358586736478,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T04:15:00',
        value: 1.0092358586736478,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T04:00:00',
        value: 1.0227926500220985,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T03:45:00',
        value: 1.0227926500220985,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T03:30:00',
        value: 1.0227926500220985,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T03:15:00',
        value: 1.0364380836579767,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T03:00:00',
        value: 1.0364380836579767,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T02:45:00',
        value: 1.0364380836579767,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T02:30:00',
        value: 1.0569382103629676,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T02:15:00',
        value: 1.0569382103629676,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T02:00:00',
        value: 1.0569382103629676,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T01:45:00',
        value: 1.0569382103629676,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T01:30:00',
        value: 1.070534222989722,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T01:15:00',
        value: 1.070534222989722,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T01:00:00',
        value: 1.070534222989722,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T00:45:00',
        value: 1.070534222989722,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T00:30:00',
        value: 1.070534222989722,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T00:15:00',
        value: 1.070534222989722,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-21T00:00:00',
        value: 1.084,
    },
    {
        variable: 'AR35FICT98.Validado',
        lastchange: '2026-08-20T23:45:00',
        value: 1.084,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-21T10:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-21T09:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-21T08:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-21T07:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-21T06:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-21T05:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-21T04:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-21T03:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-21T02:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-21T01:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-21T00:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T23:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T22:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T21:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T20:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T19:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T18:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T17:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T16:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T15:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T14:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T13:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T12:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T11:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T10:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T09:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T08:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T07:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T06:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T05:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T04:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T03:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T02:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T01:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-20T00:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-19T23:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-19T22:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-19T21:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-19T20:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-19T19:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-19T18:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-19T17:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-19T16:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-19T15:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-19T14:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-19T13:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-19T12:00:00',
        value: 0.0,
    },
    {
        variable: 'A005WI__01.Total.Horario',
        lastchange: '2026-08-19T11:00:00',
        value: 0.0,
    },
];
