import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHaversineDistanceMeters,
  verifyAttendanceAntiFraud,
} from '../src/services/attendanceAntiFraud.service.js';

test('Haversine Distance: accurately computes distances between GPS coordinates', () => {
  // Koordinat Monas Jakarta: -6.175392, 106.827153
  const lat1 = -6.175392;
  const lon1 = 106.827153;

  // Jarak ke titik yang sama persis = 0 meter
  const dZero = calculateHaversineDistanceMeters(lat1, lon1, lat1, lon1);
  assert.equal(dZero, 0);

  // Titik berjarak ~111 meter ke utara (0.001 derajat latitude ≈ 111 meter)
  const lat2 = -6.174392;
  const lon2 = 106.827153;
  const dApprox111 = calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2);
  assert.ok(dApprox111 >= 110 && dApprox111 <= 112, `Distance should be ~111m, got ${dApprox111}m`);
});

test('Attendance Anti-Fraud: Owner is exempt from geofence and photo requirements', async () => {
  const result = await verifyAttendanceAntiFraud({
    userId: 1,
    userRole: 'OWNER',
    latitude: null,
    longitude: null,
    accuracy: null,
    photo: null,
    settingsMap: {
      attendanceGeofenceEnabled: 'true',
      outletLatitude: '-6.175392',
      outletLongitude: '106.827153',
      attendanceRadiusMeters: '100',
      attendanceSelfieRequired: 'true',
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.verifiedLocation, true);
});

test('Attendance Anti-Fraud: Rejects staff outside outlet radius', async () => {
  // Outlet at Monas (-6.175392, 106.827153), Radius 100m
  const outletLat = -6.175392;
  const outletLon = 106.827153;

  // Staff is ~500m away
  const staffLat = -6.170392;
  const staffLon = 106.827153;

  const result = await verifyAttendanceAntiFraud({
    userId: 2,
    userRole: 'CASHIER',
    latitude: staffLat,
    longitude: staffLon,
    accuracy: 10,
    photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    settingsMap: {
      attendanceGeofenceEnabled: 'true',
      outletLatitude: String(outletLat),
      outletLongitude: String(outletLon),
      attendanceRadiusMeters: '100',
      attendanceSelfieRequired: 'true',
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.statusCode, 403);
  assert.match(result.error, /di luar area outlet/);
});

test('Attendance Anti-Fraud: Rejects staff when GPS is missing but geofencing is enabled', async () => {
  const result = await verifyAttendanceAntiFraud({
    userId: 2,
    userRole: 'CASHIER',
    latitude: null,
    longitude: null,
    accuracy: null,
    photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    settingsMap: {
      attendanceGeofenceEnabled: 'true',
      outletLatitude: '-6.175392',
      outletLongitude: '106.827153',
      attendanceRadiusMeters: '100',
      attendanceSelfieRequired: 'false',
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.statusCode, 400);
  assert.match(result.error, /Izin GPS/);
});

test('Attendance Anti-Fraud: Rejects staff when selfie photo is missing and required', async () => {
  const result = await verifyAttendanceAntiFraud({
    userId: 2,
    userRole: 'CASHIER',
    latitude: -6.175392,
    longitude: 106.827153,
    accuracy: 5,
    photo: '',
    settingsMap: {
      attendanceGeofenceEnabled: 'true',
      outletLatitude: '-6.175392',
      outletLongitude: '106.827153',
      attendanceRadiusMeters: '100',
      attendanceSelfieRequired: 'true',
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.statusCode, 400);
  assert.match(result.error, /Bukti Foto Wajib/);
});

test('Attendance Anti-Fraud: Accepts staff when within radius and selfie provided', async () => {
  // Staff is ~20m from outlet
  const result = await verifyAttendanceAntiFraud({
    userId: 2,
    userRole: 'CASHIER',
    latitude: -6.175392,
    longitude: 106.827300,
    accuracy: 8,
    photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    settingsMap: {
      attendanceGeofenceEnabled: 'true',
      outletLatitude: '-6.175392',
      outletLongitude: '106.827153',
      attendanceRadiusMeters: '100',
      attendanceSelfieRequired: 'true',
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.verifiedLocation, true);
  assert.ok(result.verifiedDistance < 100);
});

test('Attendance Anti-Fraud: Clock-out requires selfie when selfie required and type is out', async () => {
  const result = await verifyAttendanceAntiFraud({
    userId: 3,
    userRole: 'CASHIER',
    latitude: -6.175392,
    longitude: 106.827153,
    accuracy: 5,
    photo: '',
    settingsMap: {
      attendanceGeofenceEnabled: 'true',
      outletLatitude: '-6.175392',
      outletLongitude: '106.827153',
      attendanceRadiusMeters: '100',
      attendanceSelfieRequired: 'true',
    },
    type: 'out',
  });

  assert.equal(result.valid, false);
  assert.equal(result.statusCode, 400);
  assert.match(result.error, /pulang/i);
});
